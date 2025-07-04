const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');
const moment = require('moment');
const cron = require('node-cron');
const IotData = require('../models/iotData');
const userdb = require('../models/user');
const IotDataAverage = require(`../models/averageData`);
const DifferenceData = require(`../models/differeneceData`);
const { handleExceedValues } = require('./calibrationExceed');
const CalibrationExceedValues = require('../models/calibrationExceedValues');
const  { updateMaxMinValues,saveDailyMinMaxValues }  = require('./maxMinController')
const { io, server } = require('../app');
const { calculateTotalUsage } = require('./consumptionController');
const { saveOrUpdateLastEntryByUserName } = require('./lastIotDataController');
const { Mutex } = require('async-mutex'); // Import async-mutex to ensure atomicity
const entryMutex = new Mutex(); // Create a mutex for handling unique save operations
const AWS = require('aws-sdk');

// Function to check sensor data for zero values


// Helper Function to check data exceedance
const checkExceedance = async (stacks, user) => {
const exceedances = [];
const industryThresholds = await CalibrationExceedValues.findOne({ industryType: user.industryType });

if (!industryThresholds) {
    console.error(`No thresholds found for industry type: ${user.industryType}`);
    return { success: true, message: 'No thresholds found' };  // Allow save to continue if no thresholds
}

for (const stack of stacks) {
    for (const parameter of Object.keys(stack)) {
        const threshold = industryThresholds[parameter];
        if (threshold && stack[parameter] > threshold) {
            exceedances.push({
                parameter,
                value: stack[parameter],
                stackName: stack.stackName
            });
        }
    }
}

if (exceedances.length > 0) {
    return {
        success: true,
        exceedanceDetected: true,
        exceedanceData: {
            exceedanceComment: 'Parameter exceedance detected',
            ExceedanceColor: 'red',
            exceedances,
        }
    };
}

return { success: true, exceedanceDetected: false };
};

// Helper Function to check time interval
const checkTimeInterval = async (data, user) => {
const lastEntry = await IotData.findOne({ userName: data.userName }).sort({ timestamp: -1 });

if (lastEntry) {
    const lastEntryTimestamp = new Date(lastEntry.timestamp).getTime(); // Convert to milliseconds
    const currentTimestamp = Date.now(); // Current time in milliseconds

    const timeDifference = currentTimestamp - lastEntryTimestamp;

    // console.log('lastEntryTimestamp:', lastEntryTimestamp);
    // console.log('currentTimestamp:', currentTimestamp);
    // console.log('timeDifference:', timeDifference);

    // Check if the time difference exceeds 15 minutes (15 * 60 * 1000 milliseconds)
    const fifteenMinutes = 15 * 60 * 1000; // 15 minutes in milliseconds
    if (timeDifference > fifteenMinutes) {
        // Only check the interval if the last data entry is older than 15 minutes
       
            return {
                success: true,
                intervalExceeded: true,
                intervalData: {
                    timeIntervalComment: 'Time interval exceeded',
                    timeIntervalColor: 'purple'
                }
            };
    
    }
}

return {
    success: true,
    intervalExceeded: false,
    intervalData: {
        timeIntervalComment: 'Within allowed time interval',
        timeIntervalColor: 'green'
    }
};
};




// Function to check if required fields are missing
const checkRequiredFields = (data, requiredFields) => {
    const missingFields = requiredFields.filter(field => !data[field]);
    if (missingFields.length > 0) {
        return {
            success: false,
            message: `Missing required fields: ${missingFields.join(', ')}`,
            missingFields
        };
    }
    return {
        success: true,
        message: "All required fields are present"
    };
};


const handleSaveMessage = async (req, res) => {
    const data = req.body;
  
    // Perform validations
    const requiredFieldsCheck = checkRequiredFields(data, [
      'product_id',
      'companyName',
      'industryType',
      'userName',
      'mobileNumber',
      'email',
    ]);
    if (!requiredFieldsCheck.success) {
      return res.status(400).json(requiredFieldsCheck);
    }
  
    // Log data only for specific user
    if (data.userName === 'KSPCB013') {
      console.log('Received data for KSPCB013:', data);
    }
  
    // Allow saving if either stacks (sensor data) or tankData is provided.
    let stacks = data.stacks || data.stackData || [];
    const tankData = data.tankData || [];
    if (
      !(
        (Array.isArray(stacks) && stacks.length > 0) ||
        (Array.isArray(tankData) && tankData.length > 0)
      )
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message: 'Stacks data or Tank data is required.',
          missingFields: ['stacks/tankData'],
        });
    }
  
    const pumps = data.pumps || [];
  
    // Remove negative values from stack parameters (only for stacks)
    if (stacks.length > 0) {
      stacks = stacks.map((stack) => {
        const sanitizedStack = { stackName: stack.stackName, stationType: stack.stationType };
        for (const [key, value] of Object.entries(stack)) {
          if (key !== 'stackName' && key !== 'stationType') {
            const numericValue = parseFloat(value);
            if (!isNaN(numericValue) && numericValue >= 0) {
              sanitizedStack[key] = value;
            }
          }
        }
        return sanitizedStack;
      });
  
      // Remove empty stack entries after sanitization
      stacks = stacks.filter((stack) => Object.keys(stack).length > 2);
    }
  
    // If after sanitization there is no valid sensor data and no tank data provided, return error.
    if (stacks.length === 0 && tankData.length === 0) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            'No valid sensor or tank data to save after filtering out negative values.',
        });
    }
  
    const user = await userdb.findOne({ userName: data.userName });
    const exceedanceCheck = await checkExceedance(stacks, user);
    const timeIntervalCheck = await checkTimeInterval(data, user);
  
    // Format date and time
    const date = moment().format('DD/MM/YYYY');
    const time = moment().tz('Asia/Kolkata').format('HH:mm:ss');
  
    // Emit real-time data before saving
    req.io.to(data.userName).emit('stackDataUpdate', {
      userName: data.userName,
      exceedanceComment: exceedanceCheck.exceedanceDetected
        ? 'Parameter exceedance detected'
        : 'Within limits',
      ExceedanceColor: exceedanceCheck.exceedanceDetected ? 'red' : 'green',
      timeIntervalComment: timeIntervalCheck.intervalExceeded
        ? 'Time interval exceeded'
        : 'Within allowed time interval',
      timeIntervalColor: timeIntervalCheck.intervalExceeded ? 'purple' : 'green',
      stackData: stacks,
      // Include tankData in the event payload (e.g. [{ stackName: 'STP_Tank', dwlrid: 'DWLR01', tankName: 'Tank1', depth: 22 }])
      tankData: tankData,
      pumps: pumps.map((pump) => ({
        pumpId: pump.pumpId,
        pumpName: pump.pumpName,
        status: pump.status,
      })),
      timestamp: new Date(),
    });
  
    try {
      // Update or push sensor (stackData) entries
      if (stacks.length > 0) {
        for (const stack of stacks) {
          const existingEntry = await IotData.findOne({
            userName: data.userName,
            'stackData.stackName': stack.stackName,
          });
  
          if (existingEntry) {
            await IotData.updateOne(
              {
                userName: data.userName,
                'stackData.stackName': stack.stackName,
              },
              {
                $set: {
                  'stackData.$': { ...stack, timestamp: new Date() },
                },
              }
            );
          } else {
            await IotData.updateOne(
              { userName: data.userName },
              {
                $push: {
                  stackData: { ...stack, timestamp: new Date() },
                },
              },
              { upsert: true }
            );
          }
        }
      }
  
      // Update or push tankData entries if provided using findOneAndUpdate
      if (tankData && Array.isArray(tankData) && tankData.length > 0) {
        for (const tank of tankData) {
          console.log('Attempting to save tank data:', tank);
          const existingTank = await IotData.findOne({
            userName: data.userName,
            'tankData.tankName': tank.tankName,
          });
          if (existingTank) {
            await IotData.findOneAndUpdate(
              { userName: data.userName, 'tankData.tankName': tank.tankName },
              { $set: { 'tankData.$': { ...tank, timestamp: new Date() } } },
              { new: true }
            );
            console.log(`Tank data updated for tankName: ${tank.tankName}`);
          } else {
            await IotData.findOneAndUpdate(
              { userName: data.userName },
              { $push: { tankData: { ...tank, timestamp: new Date() } } },
              { new: true, upsert: true }
            );
            console.log(`Tank data pushed for tankName: ${tank.tankName}`);
          }
        }
      }
  
      // Prepare entry for saving all data (IoT data, pumps, and tank details)
      const newEntryData = {
        ...data,
        stackData: stacks,
        pumps: pumps.map((pump) => ({
          pumpId: pump.pumpId,
          pumpName: pump.pumpName,
          status: pump.status,
          timestamp: new Date(),
        })),
        // Save tankData (if not provided, default to an empty array)
        tankData: (tankData && Array.isArray(tankData) && tankData.length > 0)
          ? tankData
          : [],
        date,
        time,
        timestamp: new Date(),
        exceedanceComment: exceedanceCheck.exceedanceDetected
          ? 'Parameter exceedance detected'
          : 'Within limits',
        ExceedanceColor: exceedanceCheck.exceedanceDetected ? 'red' : 'green',
        timeIntervalComment: timeIntervalCheck.intervalExceeded
          ? 'Time interval exceeded'
          : 'Within allowed time interval',
        timeIntervalColor: timeIntervalCheck.intervalExceeded ? 'purple' : 'green',
        validationMessage: data.validationMessage || 'Validated',
        validationStatus: data.validationStatus || 'Valid',
      };
  
      const newEntry = new IotData(newEntryData);
      await newEntry.save();
      /* newline */
      await saveOrUpdateLastEntryByUserName(newEntryData);

  
      await updateMaxMinValues(newEntryData);
      handleExceedValues();
      console.log('\n🔄 IoT Data being processed:', JSON.stringify(newEntryData, null, 2));
      const updatedLastEntry = await saveOrUpdateLastEntryByUserName(newEntryData);
      console.log(`✅ LastIoTData updated:`, JSON.stringify(updatedLastEntry, null, 2));
  
      res.status(200).json({
        success: true,
        message: 'New Entry data saved successfully',
        newEntry,
      });
    } catch (error) {
      console.error('Error saving data:', error);
      res.status(500).json({ success: false, message: 'Error saving data', error: error.message });
    }
  };
  







// Configure AWS SDK
// Configure AWS SDK
AWS.config.update({
accessKeyId: process.env.AWS_ACCESS_KEY_ID,
secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
region: process.env.AWS_REGION
});

const s3 = new AWS.S3();

/**
* Fetch data from S3 bucket.
* @returns {Promise<Array>} - Parsed data from S3 file (JSON format).
*/
const fetchDataFromS3 = async () => {
try {
    const key = 'iot_data/iotData.json';  // Always fetching from the same file

    console.log(`Fetching data from S3 with key: ${key}`);
    const params = {
        Bucket: 'ems-ebhoom-bucket', // Your bucket name
        Key: key
    };

    const s3Object = await s3.getObject(params).promise();
    const fileContent = s3Object.Body.toString('utf-8');

    // Parse JSON content
    const jsonData = JSON.parse(fileContent);

    console.log("Fetched S3 Data Length:", jsonData.length);

    return jsonData;
} catch (error) {
    console.error('Error fetching data from S3:', error);
    throw new Error('Failed to fetch data from S3');
}
};


const getIotDataByUserNameAndStackName = async (req, res) => {
const { userName, stackName } = req.params;

try {
    // Fetch data from S3 bucket
    const s3Data = await fetchDataFromS3('iot_data/iotData.json'); // Specify your S3 file key

    // Filter the S3 data based on userName and stackName
    let filteredData = s3Data.filter(entry => entry.userName === userName && entry.stackData.some(stack => stack.stackName === stackName));

    // Further filter the stackData to only include the matching stackName
    filteredData = filteredData.map(entry => {
        const stackData = entry.stackData.filter(stack => stack.stackName === stackName);
        return {
            ...entry,
            stackData  // Replace stackData with the filtered version
        };
    });

    if (filteredData.length === 0) {
        return res.status(404).json({
            status: 404,
            success: false,
            message: `No data found for userName: ${userName} and stackName: ${stackName} in S3.`,
        });
    }

    res.status(200).json({
        status: 200,
        success: true,
        message: `IoT data for userName ${userName} and stackName ${stackName} fetched successfully from S3`,
        data: filteredData,
    });

} catch (error) {
    console.error(`Error Fetching IoT data by userName and stackName:`, error);
    res.status(500).json({
        status: 500,
        success: false,
        message: `Error Fetching IoT data by userName and stackName || Internal Server error`,
        error: error.message,
    });
}
};





const getIotDataByCompanyNameAndStackName = async (req, res) => {
let { companyName, stackName } = req.params;

try {
    // Decode the companyName to handle %20 or other encoded characters
    companyName = decodeURIComponent(companyName);

    // Fetch data from S3 bucket
    const s3Data = await fetchDataFromS3('iot_data/iotData.json'); // Specify your S3 file key

    // Filter the S3 data based on companyName and stackName
    let filteredData = s3Data.filter(entry => entry.companyName === companyName && entry.stackData.some(stack => stack.stackName === stackName));

    // Further filter the stackData to only include the matching stackName
    filteredData = filteredData.map(entry => {
        const stackData = entry.stackData.filter(stack => stack.stackName === stackName);
        return {
            ...entry,
            stackData,  // Replace stackData with the filtered version
            userName: entry.userName,  // Include userName from S3 data
            industryType: entry.industryType,  // Include industryType from S3 data
            companyName: entry.companyName  // Include companyName from S3 data
        };
    });

    if (filteredData.length === 0) {
        return res.status(404).json({
            status: 404,
            success: false,
            message: `No IoT data found for companyName: ${companyName} and stackName: ${stackName} in S3.`,
        });
    }

    res.status(200).json({
        status: 200,
        success: true,
        message: `IoT data for companyName ${companyName} and stackName ${stackName} fetched successfully from S3`,
        data: filteredData,
    });

} catch (error) {
    console.error(`Error Fetching IoT data by companyName and stackName:`, error);
    res.status(500).json({
        status: 500,
        success: false,
        message: `Error Fetching IoT data by companyName and stackName || Internal Server error`,
        error: error.message,
    });
}
};





// const getAllIotData =async (req,res)=>{
//     try{
//         const allData =await IotData.find({});
    
//         res.status(200).json({
//             status:200,
//             success:true,
//             message:'All IoT data fetched Succesfully',
//             data:allData
//         })
//     }catch(error){
//         console.error('Error fetching IoT data:',error);
//         res.status(500).json({
//             success:false,
//             message:'Error fetching IoT data',
//             error:error.message
//         })
//     }
// }

const getLatestIoTData = async (req, res) => {
const { userName } = req.params;
try {
    const latestData = await IotData.aggregate([
        { $match: { userName: userName } },
        { $sort: { timestamp: -1 } }, // Sort by timestamp in descending order 
        {
            $group: {
                _id: "$product_id",
                latestRecord: { $first: "$$ROOT" }
            }
        },
        { $replaceRoot: { newRoot: "$latestRecord" } }
    ]).allowDiskUse(true); // Enable disk usage for sorting

    res.status(200).json({
        status: 200,
        success: true,
        message: 'Latest IoT Data fetched successfully',
        data: latestData
    });
} catch (error) {
    console.error('Error fetching latest IoT Data:', error);
    res.status(500).json({
        status: 500,
        success: false,
        message: 'Error fetching latest IoT data',
        error: error.message
    });
}
};

/* 10 min data */
const getLast10MinIoTData = async (req, res) => {
const { userName } = req.params;

try {
    // Get the current timestamp and calculate the timestamp for 10 minutes ago
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes in milliseconds

    const dataFromLast10Min = await IotData.aggregate([
        // Match documents with the specified userName and timestamp within the last 10 minutes
        {
            $match: {
                userName: userName,
                timestamp: { $gte: tenMinutesAgo } // Filter records from the last 10 minutes
            }
        },
        { $sort: { timestamp: -1 } }, // Sort by timestamp in descending order
        {
            $group: {
                _id: "$product_id",
                records: { $push: "$$ROOT" } // Collect all records for each product_id
            }
        },
        { 
            $project: {
                _id: 0, // Exclude _id field
                product_id: "$_id",
                records: 1 // Include all matching records in the group
            }
        }
    ]).allowDiskUse(true); // Enable disk usage for sorting

    res.status(200).json({
        status: 200,
        success: true,
        message: 'IoT Data from the last 10 minutes fetched successfully',
        data: dataFromLast10Min
    });
} catch (error) {
    console.error('Error fetching IoT Data from the last 10 minutes:', error);
    res.status(500).json({
        status: 500,
        success: false,
        message: 'Error fetching IoT data',
        error: error.message
    });
}
};

const getIotDataByUserName = async (req, res) => {
const { userName } = req.params;

try {
    // Fetch data from S3
    const s3Data = await fetchDataFromS3('iot_data/iotData.json');  // Specify the S3 file key

    // Filter the S3 data based on userName
    const filteredData = s3Data.filter(entry => entry.userName === userName);

    if (filteredData.length === 0) {
        return res.status(404).json({
            status: 404,
            success: false,
            message: `No IoT data found for userName: ${userName} in S3`,
        });
    }

    res.status(200).json({
        status: 200,
        success: true,
        message: `IoT data for userName ${userName} fetched successfully`,
        data: filteredData,
    });
} catch (error) {
    console.error('Error Fetching IoT data by userName:', error);
    res.status(500).json({
        status: 500,
        success: false,
        message: 'Error Fetching IoT data by userName || Internal Server error',
        error: error.message,
    });
}
};


const getIotDataByCompanyName = async (req, res) => {
const { companyName } = req.params;

try {
    // Fetch data from S3
    const s3Data = await fetchDataFromS3('iot_data/iotData.json');  // Specify the S3 file key

    // Filter the S3 data based on companyName
    const filteredData = s3Data.filter(entry => entry.companyName === companyName);

    if (filteredData.length === 0) {
        return res.status(404).json({
            status: 404,
            success: false,
            message: `No IoT data found for companyName: ${companyName} in S3`,
        });
    }

    res.status(200).json({
        status: 200,
        success: true,
        message: `IoT data for companyName ${companyName} fetched successfully`,
        data: filteredData,
    });
} catch (error) {
    console.error('Error Fetching IoT data by companyName:', error);
    res.status(500).json({
        status: 500,
        success: false,
        message: 'Error Fetching IoT data by companyName || Internal Server error',
        error: error.message,
    });
}
};


//End of Averages // 

//Download Entire IOT Data

const downloadIotData = async (req, res) => {
try {
    let { fromDate, toDate, industryName, companyName, format } = req.query;

    // Decode the URL-encoded parameters
    industryName = decodeURIComponent(industryName.trim());
    companyName = decodeURIComponent(companyName.trim());

    // Ensure dates are in the correct format
    fromDate = moment(fromDate, 'DD-MM-YYYY').format('DD/MM/YYYY');
    toDate = moment(toDate, 'DD-MM-YYYY').format('DD/MM/YYYY');

    // Log the parameters for debugging
    console.log("Query Parameters:", { fromDate, toDate, industryName, companyName, format });

    // Validate input
    if (!fromDate || !toDate || !industryName || !companyName) {
        return res.status(400).send('Missing required query parameters');
    }

    // Find IoT data based on filters from MongoDB
    const data = await IotData.find({
        industryType: industryName,
        companyName: companyName,
        date: {
            $gte: fromDate,
            $lte: toDate,
        },
    }).lean();

    let filteredData = data;

    if (filteredData.length === 0) {
        console.log("No data found with criteria:", { fromDate, toDate, industryName, companyName });
        console.log("Fetching from S3...");

        // If no data is found in MongoDB, fetch data from S3
        const s3Data = await fetchDataFromS3('iot_data/iotData.json');  // Specify the S3 file key

        if (s3Data.length === 0) {
            return res.status(404).send('No data found for the specified criteria');
        }

        // Filter the S3 data based on industryName and companyName
        filteredData = s3Data.filter(entry =>
            entry.industryType === industryName && entry.companyName === companyName
        );
    }

    // Prepare the data in the required format (CSV or PDF)
    if (format === 'csv') {
        // Prepare CSV data
        const fields = [
            'userName', 'industryType', 'companyName', 'date', 'time', 'product_id',
            'ph', 'TDS', 'turbidity', 'temperature', 'BOD', 'COD', 'TSS', 'ORP',
            'nitrate', 'ammonicalNitrogen', 'DO', 'chloride', 'Flow', 'CO', 'NOX',
            'Pressure', 'Flouride', 'PM', 'SO2', 'NO2', 'Mercury', 'PM10', 'PM25',
            'NOH', 'NH3', 'WindSpeed', 'WindDir', 'AirTemperature', 'Humidity',
            'solarRadiation', 'DB', 'inflow', 'finalflow', 'energy', 'voltage',
            'current', 'power', 'topic', 'mobileNumber', 'email',
            'validationStatus', 'validationMessage', 'timestamp'
        ];

        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(filteredData);

        res.header('Content-Type', 'text/csv');
        res.attachment('data.csv');
        return res.send(csv);
    } else if (format === 'pdf') {
        // Generate PDF
        const doc = new PDFDocument();
        res.header('Content-Type', 'application/pdf');
        res.attachment('data.pdf');

        doc.pipe(res);

        doc.fontSize(20).text('IoT Data Report', { align: 'center' });
        doc.fontSize(12).text(`Industry Type: ${industryName}`);
        doc.fontSize(12).text(`Company Name: ${companyName}`);
        doc.fontSize(12).text(`Date Range: ${fromDate} - ${toDate}`);
        doc.moveDown();

        filteredData.forEach(item => {
            doc.fontSize(10).text(JSON.stringify(item), {
                width: 410,
                align: 'left'
            });
            doc.moveDown();
        });

        doc.end();
    } else {
        return res.status(400).send('Invalid format requested');
    }
} catch (error) {
    console.error('Error fetching or processing data:', error);
    res.status(500).send('Internal Server Error');
}
};



const getDifferenceDataByUserName = async (req, res) => {
const { userName } = req.params;

try {
    // Fetch data from MongoDB
    const mongoData = await DifferenceData.find({ userName }).lean();

    // Fetch data from S3
    const s3Params = {
        Bucket: 'ems-ebhoom-bucket', // Replace with your bucket name
        Key: 'difference_data/hourlyDifferenceData.json', // Replace with your S3 file path
    };

    let s3Data = [];
    try {
        const s3Object = await s3.getObject(s3Params).promise();
        s3Data = JSON.parse(s3Object.Body.toString('utf-8')).filter(
            (item) => item.userName === userName
        );
    } catch (err) {
        if (err.code === 'NoSuchKey') {
            console.log('No data found in S3 for the specified userName.');
        } else {
            throw err;
        }
    }

    // Combine MongoDB and S3 data
    const combinedData = [...mongoData, ...s3Data];

    if (combinedData.length === 0) {
        return res.status(404).json({
            status: 404,
            success: false,
            message: 'No difference data found for the specified userName',
        });
    }

    res.status(200).json({
        status: 200,
        success: true,
        message: `Difference data for userName ${userName} fetched successfully`,
        data: combinedData,
    });
} catch (error) {
    console.error(`Error fetching difference data by userName:`, error);
    res.status(500).json({
        status: 500,
        success: false,
        message: `Error fetching difference data by userName`,
        error: error.message,
    });
}
};

const getDifferenceDataByUserNameAndDateRange = async (req, res) => {
const { userName, fromDate, toDate } = req.query;

try {
    if (!userName || !fromDate || !toDate) {
        return res.status(400).json({
            status: 400,
            success: false,
            message: 'Missing required query parameters: userName, fromDate, toDate',
        });
    }

    // Convert fromDate and toDate to proper date objects
    const startDate = moment.tz(fromDate, 'DD-MM-YYYY', 'Asia/Kolkata').startOf('day').toDate();
    const endDate = moment.tz(toDate, 'DD-MM-YYYY', 'Asia/Kolkata').endOf('day').toDate();

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({
            status: 400,
            success: false,
            message: 'Invalid date format. Use "DD-MM-YYYY".',
        });
    }

    // Fetch data from MongoDB
    const mongoData = await DifferenceData.find({
        userName,
        timestamp: { $gte: startDate, $lte: endDate }, // Ensure timestamp is properly filtered
    }).lean();

    // Fetch data from S3
    const s3Params = {
        Bucket: 'ems-ebhoom-bucket', // Replace with your bucket name
        Key: 'difference_data/hourlyDifferenceData.json', // Replace with your S3 file path
    };

    let s3Data = [];
    try {
        const s3Object = await s3.getObject(s3Params).promise();
        const s3RawData = JSON.parse(s3Object.Body.toString('utf-8'));

        // Filter S3 data based on date range
        s3Data = s3RawData.filter((item) => {
            const itemTimestamp = moment(item.timestamp).toDate();
            return (
                item.userName === userName &&
                itemTimestamp >= startDate &&
                itemTimestamp <= endDate
            );
        });
    } catch (err) {
        if (err.code === 'NoSuchKey') {
            console.log('No data found in S3 for the specified userName and date range.');
        } else {
            throw err;
        }
    }

    // Combine MongoDB and S3 data
    const combinedData = [...mongoData, ...s3Data];

    if (combinedData.length === 0) {
        return res.status(404).json({
            status: 404,
            success: false,
            message: 'No difference data found for the specified userName and date range',
        });
    }

    // Sort combined data by timestamp (if needed)
    combinedData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    res.status(200).json({
        status: 200,
        success: true,
        message: `Difference data for userName ${userName} from ${fromDate} to ${toDate} fetched successfully`,
        data: combinedData,
    });
} catch (error) {
    console.error(`Error fetching difference data by userName and date range:`, error);
    res.status(500).json({
        status: 500,
        success: false,
        message: `Error fetching difference data by userName and date range`,
        error: error.message,
    });
}
};


const downloadIotDataByUserName = async (req, res) => {
try {
    let { userName, fromDate, toDate, format } = req.query;

    // Decode the URL-encoded parameters
    userName = decodeURIComponent(userName.trim());

    // Parse the dates correctly in 'YYYY-MM-DD' format to ensure proper querying
    const parsedFromDate = moment(fromDate, 'DD-MM-YYYY').startOf('day').toDate();  // Changed to .toDate() to handle Date type in MongoDB
    const parsedToDate = moment(toDate, 'DD-MM-YYYY').endOf('day').toDate();        // Changed to .toDate() to handle Date type

    // Log the parameters for debugging
    console.log("Query Parameters:", { parsedFromDate, parsedToDate, userName, format });

    // Validate input
    if (!parsedFromDate || !parsedToDate || !userName) {
        return res.status(400).send('Missing required query parameters');
    }

    // Query data using correct date range
    const data = await IotData.find({
        userName: userName,
        timestamp: {
            $gte: parsedFromDate,  // Data from the start of fromDate
            $lte: parsedToDate     // Data until the end of toDate
        }
    }).lean();

    if (data.length === 0) {
        console.log("No data found with criteria:", { parsedFromDate, parsedToDate, userName });
        return res.status(404).send('No data found for the specified criteria');
    }

    if (format === 'csv') {
        // Generate CSV
        const fields = ['userName', 'industryType', 'companyName', 'date', 'time', 'product_id', 'ph', 'TDS', 'turbidity', 'temperature', 'BOD', 'COD', 'TSS', 'ORP', 'nitrate', 'ammonicalNitrogen', 'DO', 'chloride', 'PM', 'PM10', 'PM25', 'NOH', 'NH3', 'WindSpeed', 'WindDir', 'AirTemperature', 'Humidity', 'solarRadiation', 'DB', 'inflow','CO','NOX','SO2','Pressure','Flouride','Flow', 'finalflow', 'energy'];
        const json2csvParser = new Parser({ fields });
        const csv = json2csvParser.parse(data);

        res.header('Content-Type', 'text/csv');
        res.attachment('data.csv');
        return res.send(csv);
    } else if (format === 'pdf') {
        // Generate PDF
        const doc = new PDFDocument();
        res.header('Content-Type', 'application/pdf');
        res.attachment('data.pdf');

        doc.pipe(res);

        doc.fontSize(20).text('IoT Data Report', { align: 'center' });
        doc.fontSize(12).text(`User Name: ${userName}`);
        doc.fontSize(12).text(`Date Range: ${fromDate} - ${toDate}`);
        doc.moveDown();

        data.forEach(item => {
            doc.fontSize(10).text(JSON.stringify(item), {
                width: 410,
                align: 'left'
            });
            doc.moveDown();
        });

        doc.end();
    } else {
        return res.status(400).send('Invalid format requested');
    }
} catch (error) {
    console.error('Error fetching or processing data:', error);
    res.status(500).send('Internal Server Error');
}
};


// const downloadIotDataByUserNameAndStackName = async (req, res) => {
//     try {
//         let { userName, stackName, fromDate, toDate, format, page = 1 } = req.query;

//         // Decode parameters and validate input
//         userName = decodeURIComponent(userName.trim());
//         stackName = decodeURIComponent(stackName.trim());

//         const parsedFromDate = moment(fromDate, 'DD-MM-YYYY').startOf('day').toDate();
//         const parsedToDate = moment(toDate, 'DD-MM-YYYY').endOf('day').toDate();

//         if (!parsedFromDate || !parsedToDate || !userName || !stackName) {
//             return res.status(400).send('Missing required query parameters');
//         }

//         // Use pagination to fetch data in batches (page size is handled internally by skip)
//         const pageSize = 1000;  // Fetch 1000 records per batch
//         const skip = (page - 1) * pageSize;

//         // Query IoT data with pagination and filtering
//         const data = await IotData.find({
//             userName,
//             'stackData.stackName': stackName,
//             timestamp: { $gte: parsedFromDate, $lte: parsedToDate }
//         })
//         .skip(skip)
//         .limit(pageSize)
//         .lean();

//         if (data.length === 0) {
//             return res.status(404).send('No data found for the specified criteria');
//         }

//         // Extract dynamic fields from the stackData, excluding '_id'
//         const stackKeys = Object.keys(data[0].stackData[0]?.parameters || {}).filter(key => key !== '_id');

//         if (format === 'csv') {
//             // Prepare CSV data
//             const fields = ['Date', 'Time', 'Stack Name', ...stackKeys];
//             const csvData = data.flatMap(item =>
//                 item.stackData.map(stack => ({
//                     Date: moment(item.timestamp).format('DD-MM-YYYY'),
//                     Time: moment(item.timestamp).format('HH:mm:ss'),
//                     'Stack Name': stack.stackName,
//                     ...stack.parameters,
//                 }))
//             );

//             const parser = new Parser({ fields });
//             const csv = parser.parse(csvData);

//             res.header('Content-Type', 'text/csv');
//             res.attachment(`${userName}_${stackName}_iot_data.csv`);
//             return res.send(csv);
//         } else if (format === 'pdf') {
//             // Generate PDF with paginated data
//             const doc = new PDFDocument();
//             res.header('Content-Type', 'application/pdf');
//             res.attachment(`${userName}_${stackName}_iot_data.pdf`);

//             doc.pipe(res);
//             doc.fontSize(20).text('IoT Data Report', { align: 'center' });
//             doc.fontSize(12).text(`User Name: ${userName}`);
//             doc.fontSize(12).text(`Stack Name: ${stackName}`);
//             doc.fontSize(12).text(`Date Range: ${fromDate} - ${toDate}`);
//             doc.moveDown();

//             data.forEach(item => {
//                 item.stackData.forEach(stack => {
//                     doc.fontSize(12).text(`Date: ${moment(item.timestamp).format('DD-MM-YYYY')}`);
//                     doc.text(`Time: ${moment(item.timestamp).format('HH:mm:ss')}`);
//                     doc.fontSize(12).text(`Stack: ${stack.stackName}`, { underline: true });

//                     const keys = Object.keys(stack.parameters || {});
//                     const tableData = keys.map(key => `${key}: ${stack.parameters[key]}`).join(', ');

//                     doc.text(tableData);
//                     doc.moveDown();
//                 });
//             });

//             doc.end();
//         } else {
//             res.status(400).send('Invalid format requested');
//         }
//     } catch (error) {
//         console.error('Error fetching or processing data:', error);
//         res.status(500).send('Internal Server Error');
//     }
// };

//
const downloadIotDataByUserNameAndStackName = async (req, res) => {
try {
    let { userName, stackName, fromDate, toDate, format, page = 1 } = req.query;

    // Decode parameters and validate input
    userName = decodeURIComponent(userName.trim());
    stackName = decodeURIComponent(stackName.trim());

    const parsedFromDate = moment(fromDate, 'DD-MM-YYYY').startOf('day').toDate();
    const parsedToDate = moment(toDate, 'DD-MM-YYYY').endOf('day').toDate();

    if (!parsedFromDate || !parsedToDate || !userName || !stackName) {
        return res.status(400).send('Missing required query parameters');
    }

    // Use pagination to fetch data in batches (page size is handled internally by skip)
    const pageSize = 1000;  // Fetch 1000 records per batch
    const skip = (page - 1) * pageSize;

    // Query IoT data with pagination and filtering from MongoDB
    const data = await IotData.find({
        userName,
        'stackData.stackName': stackName,
        timestamp: { $gte: parsedFromDate, $lte: parsedToDate }
    })
    .skip(skip)
    .limit(pageSize)
    .lean();

    console.log("MongoDB Data Length:", data.length);

    let s3Data = [];

    if (!data.length) {
        console.log("No data found in MongoDB. Fetching from S3...");

        // Fetch data from S3 if no MongoDB data found
        s3Data = await fetchDataFromS3();

        if (s3Data.length === 0) {
            return res.status(404).send('No data found for the specified criteria');
        }
    }

    // Merge MongoDB data with S3 data
    const allData = [...data, ...s3Data];

    // Filter out only the relevant stack data based on stackName
    const filteredData = allData.map(entry => {
        if (entry.stackData && Array.isArray(entry.stackData)) {
            return {
                ...entry,
                stackData: entry.stackData.filter(stack => stack.stackName === stackName),
            };
        } else {
            return { ...entry, stackData: [] };
        }
    }).filter(entry => entry.stackData && entry.stackData.length > 0); // Ensure only non-empty entries are included

    console.log("Filtered Data Length:", filteredData.length);

    // Determine the format to return
    if (format === 'csv') {
        // Prepare CSV data
        const fields = ['Date', 'Time', 'Stack Name', ...Object.keys(filteredData[0]?.stackData[0]?.parameters || {})];
        const csvData = filteredData.flatMap(item =>
            item.stackData.map(stack => ({
                Date: moment(item.timestamp).format('DD-MM-YYYY'),
                Time: moment(item.timestamp).format('HH:mm:ss'),
                'Stack Name': stack.stackName,
                ...stack.parameters,
            }))
        );

        const parser = new Parser({ fields });
        const csv = parser.parse(csvData);

        res.header('Content-Type', 'text/csv');
        res.attachment(`${userName}_${stackName}_iot_data.csv`);
        return res.send(csv);
    } else if (format === 'pdf') {
        // Generate PDF with paginated data
        const doc = new PDFDocument();
        res.header('Content-Type', 'application/pdf');
        res.attachment(`${userName}_${stackName}_iot_data.pdf`);

        doc.pipe(res);
        doc.fontSize(20).text('IoT Data Report', { align: 'center' });
        doc.fontSize(12).text(`User Name: ${userName}`);
        doc.fontSize(12).text(`Stack Name: ${stackName}`);
        doc.fontSize(12).text(`Date Range: ${fromDate} - ${toDate}`);
        doc.moveDown();

        filteredData.forEach(item => {
            item.stackData.forEach(stack => {
                doc.fontSize(12).text(`Date: ${moment(item.timestamp).format('DD-MM-YYYY')}`);
                doc.text(`Time: ${moment(item.timestamp).format('HH:mm:ss')}`);
                doc.fontSize(12).text(`Stack: ${stack.stackName}`, { underline: true });

                const keys = Object.keys(stack.parameters || {});
                const tableData = keys.map(key => `${key}: ${stack.parameters[key]}`).join(', ');

                doc.text(tableData);
                doc.moveDown();
            });
        });

        doc.end();
    } else {
        res.status(400).send('Invalid format requested');
    }
} catch (error) {
    console.error('Error fetching or processing data:', error);
    res.status(500).send('Internal Server Error');
}
};



// const viewDataByDateUserAndStackName = async (req, res) => {
//     const { fromDate, toDate, userName, stackName, limit = 10, page = 1 } = req.query;

//     try {
//         // Parse the input dates to ISO Date objects for accurate querying
//         const parsedFromDate = moment(fromDate, 'DD-MM-YYYY').startOf('day').toDate();
//         const parsedToDate = moment(toDate, 'DD-MM-YYYY').endOf('day').toDate();

//         if (!parsedFromDate || !parsedToDate || !userName || !stackName) {
//             return res.status(400).json({ message: 'Missing required query parameters' });
//         }

//         console.log("Parsed Dates:", { parsedFromDate, parsedToDate });

//         // Build the query with proper date range, userName, and stackName filtering
//         const query = {
//             userName: userName,
//             timestamp: { // Use timestamp for accurate date-based queries
//                 $gte: parsedFromDate,
//                 $lte: parsedToDate
//             },
//             'stackData.stackName': stackName // Filter by stackName
//         };

//         // Calculate the number of items to skip based on the page and limit
//         const skip = (page - 1) * limit;

//         // Query the data with pagination (limit and skip)
//         const data = await IotData.find(query)
//             .skip(skip) // Skip the previous pages' data
//             .limit(parseInt(limit)) // Limit the number of results per page
//             .lean();

//         if (!data.length) {
//             console.log("No data found with criteria:", { parsedFromDate, parsedToDate, userName, stackName });
//             return res.status(404).json({ message: "No data record is saved on these dates for the given user and stack name." });
//         }

//         // Filter out only the relevant stack data
//         const filteredData = data.map(entry => ({
//             ...entry,
//             stackData: entry.stackData.filter(stack => stack.stackName === stackName),
//         })).filter(entry => entry.stackData.length > 0); // Ensure only non-empty entries are included

//         res.status(200).json({ 
//             data: filteredData, 
//             currentPage: parseInt(page), 
//             totalRecords: data.length 
//         });
//     } catch (error) {
//         console.error('Failed to view data:', error);
//         res.status(500).json({ message: "Failed to process request" });
//     }
// };

const viewDataByDateUserAndStackName = async (req, res) => {
const { fromDate, toDate, userName, stackName, limit = 10, page = 1 } = req.query;

try {
    // Parse the input dates to ISO Date objects for accurate querying
    const parsedFromDate = moment(fromDate, 'DD-MM-YYYY').startOf('day').toDate();
    const parsedToDate = moment(toDate, 'DD-MM-YYYY').endOf('day').toDate();

    if (!parsedFromDate || !parsedToDate || !userName || !stackName) {
        return res.status(400).json({ message: 'Missing required query parameters' });
    }

    console.log("Parsed Dates:", { parsedFromDate, parsedToDate });

    // Build the MongoDB query with proper date range, userName, and stackName filtering
    const query = {
        userName: userName,
        timestamp: { // Use timestamp for accurate date-based queries
            $gte: parsedFromDate,
            $lte: parsedToDate
        },
        'stackData.stackName': stackName // Filter by stackName
    };

    console.log("MongoDB Query:", query);

    // Calculate the number of items to skip based on the page and limit
    const skip = (page - 1) * limit;

    // Query the data with pagination (limit and skip)
    const data = await IotData.find(query)
        .skip(skip) // Skip the previous pages' data
        .limit(parseInt(limit)) // Limit the number of results per page
        .lean();

    console.log("MongoDB Data Length:", data.length);

    let s3Data = [];

    if (!data.length) {
        console.log("No data found in MongoDB. Fetching from S3...");

        // Fetch data from S3
        s3Data = await fetchDataFromS3();

        console.log("Fetched S3 Data Length:", s3Data.length);

        if (s3Data.length === 0) {
            return res.status(404).json({
                message: `No data found for userName: ${userName} and stackName: ${stackName} within the given date range from S3.`
            });
        }
    }

    // Merge MongoDB data with S3 data
    const allData = [...data, ...s3Data];

    // Filter out only the relevant stack data, ensure stackData exists before filtering
    const filteredData = allData.map(entry => {
        // Ensure stackData exists and filter based on stackName
        if (entry.stackData && Array.isArray(entry.stackData)) {
            return {
                ...entry,
                stackData: entry.stackData.filter(stack => stack.stackName === stackName),
            };
        } else {
            // If stackData is missing, return the entry with an empty stackData array
            return {
                ...entry,
                stackData: []
            };
        }
    }).filter(entry => entry.stackData && entry.stackData.length > 0); // Ensure only non-empty entries are included

    console.log("Filtered Data Length:", filteredData.length);

    res.status(200).json({
        data: filteredData,
        currentPage: parseInt(page),
        totalRecords: allData.length
    });
} catch (error) {
    console.error('Failed to view data:', error);
    res.status(500).json({ message: "Failed to process request" });
}
};



const deleteIotDataByDateAndUser = async (req, res) => {
try {
    let { userName, fromDate, toDate } = req.query;

    // Ensure all required parameters are present
    if (!userName || !fromDate || !toDate) {
        return res.status(400).send('Missing required query parameters');
    }

    // Decode the URL-encoded parameters
    userName = decodeURIComponent(userName.trim());

    // Parse the dates in 'YYYY-MM-DD' format to ensure proper querying
    const parsedFromDate = moment(fromDate, 'DD-MM-YYYY').startOf('day').toDate();  // Start of the day for fromDate
    const parsedToDate = moment(toDate, 'DD-MM-YYYY').endOf('day').toDate();        // End of the day for toDate

    // Log the parameters for debugging
    console.log("Delete Operation Parameters:", { parsedFromDate, parsedToDate, userName });

    // Fetch data from MongoDB first
    const deleteResult = await IotData.deleteMany({
        userName: userName,
        timestamp: {
            $gte: parsedFromDate,  // Data from the start of fromDate
            $lte: parsedToDate     // Data until the end of toDate
        }
    });

    // Check if any data was deleted from MongoDB
    if (deleteResult.deletedCount === 0) {
        console.log("No data found to delete in MongoDB with the specified criteria:", { userName, parsedFromDate, parsedToDate });
    }

    // Fetch data from S3
    const s3Data = await fetchDataFromS3('iot_data/iotData.json');  // Specify the S3 file key

    if (s3Data.length === 0) {
        return res.status(404).send('No data found in S3 for the specified criteria');
    }

    // Filter out the records that match the userName and date range from the S3 data
    const filteredS3Data = s3Data.filter(entry => entry.userName === userName && 
        moment(entry.timestamp).isBetween(parsedFromDate, parsedToDate, null, '[]'));

    // Remove matching records from S3 data (simulating delete)
    const updatedS3Data = s3Data.filter(entry => 
        !(entry.userName === userName && 
        moment(entry.timestamp).isBetween(parsedFromDate, parsedToDate, null, '[]'))
    );

    // If any data was removed, update the S3 file
    if (filteredS3Data.length > 0) {
        // Upload the updated data back to S3 (this simulates the deletion)
        const params = {
            Bucket: 'ems-ebhoom-bucket',
            Key: 'iot_data/iotData.json', // Same key as before
            Body: JSON.stringify(updatedS3Data), // Updated S3 data without the deleted entries
            ContentType: 'application/json',
        };

        await s3.putObject(params).promise();
        console.log(`${filteredS3Data.length} records removed from S3.`);
    }

    // Return success message
    res.status(200).send({
        message: `Deleted ${deleteResult.deletedCount} records from MongoDB and ${filteredS3Data.length} records from S3.`,
    });

} catch (error) {
    console.error('Error deleting data:', error);
    res.status(500).send('Internal Server Error');
}
};

const getRealTimeIoTData = async (req, res) => {
  const { userName } = req.params;
  try {
    // find the single most‐recent entry for this user
    const latest = await IotData
      .findOne({ userName })
      .sort({ timestamp: -1 })      // newest first
      .lean();

    if (!latest) {
      return res.status(404).json({
        success: false,
        message: `No real-time data found for userName "${userName}"`,
      });
    }

    res.json({
      success: true,
      data: latest,
    });
  } catch (err) {
    console.error("Error in getRealTimeIoTData:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};
module.exports ={handleSaveMessage,  getLatestIoTData,getIotDataByUserName,
downloadIotData,getDifferenceDataByUserName,downloadIotDataByUserName,
deleteIotDataByDateAndUser,downloadIotDataByUserNameAndStackName,getIotDataByUserNameAndStackName,getIotDataByCompanyNameAndStackName,
getIotDataByCompanyName,viewDataByDateUserAndStackName,getDifferenceDataByUserNameAndDateRange , getLast10MinIoTData,getRealTimeIoTData
}


// const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
// const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
//getAllIotData,