const IotData = require('../models/iotData');
const IotDataAverage = require('../models/averageData');
const cron = require('node-cron');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');
const AWS = require('aws-sdk');
const moment = require('moment');



const calculateAverages = async (userName, product_id, stackName, interval) => {
    const nowIST = moment().tz('Asia/Kolkata'); // Get current IST time

    let startTime, endTime;
    if (interval === 'hour') {
        startTime = nowIST.clone().startOf('hour').toDate(); // Example: 01:00:00
        endTime = nowIST.clone().endOf('hour').toDate();       // Example: 01:59:59
    } else if (interval === 'day') {
        startTime = nowIST.clone().subtract(1, 'day').startOf('day').toDate(); // Yesterday 00:00:00
        endTime = nowIST.clone().subtract(1, 'day').endOf('day').toDate();       // Yesterday 23:59:59
    } else {
        return console.log(`⚠️ Unsupported interval: ${interval}`);
    }

    console.log(`\n🔍 Starting Average Calculation for: ${userName}, Stack: ${stackName || "All"}, Interval: ${interval}`);
    console.log(`⏳ Time Range: ${startTime} - ${endTime}`);

    try {
        // **Check for Existing Daily Entry**
        if (interval === 'day') {
            const existingDailyEntry = await IotDataAverage.findOne({
                userName,
                product_id,
                interval: 'day',
                date: nowIST.clone().subtract(1, 'day').format('DD/MM/YYYY'),
            });
            if (existingDailyEntry) {
                console.log(`⚠️ Daily average entry already exists for ${userName}, Stack: ${stackName}. Skipping.`);
                return;
            }
        }

        // Build the aggregation pipeline
        const pipeline = [
            { 
                $match: { 
                    userName, 
                    product_id, 
                    timestamp: { $gte: startTime, $lt: endTime } 
                } 
            },
            { $unwind: '$stackData' }
        ];

        // If a stackName is provided, match on it and exclude stationTypes "energy" and "effluent flow".
        // Otherwise, include all records (even with no stackName) that have stationType "effluent" or "emmision".
        if (stackName) {
            pipeline.push({
                $match: {
                    'stackData.stackName': stackName,
                    'stackData.stationType': { $nin: ["energy", "effluent flow"] }
                }
            });
        } else {
            pipeline.push({
                $match: {
                    'stackData.stationType': { $in: ["effluent", "emmision"] }
                }
            });
        }

        const data = await IotData.aggregate(pipeline);
        console.log(`📊 Extracted ${data.length} IoT Data Entries`);

        if (data.length === 0) {
            console.log(`⚠️ No IoT Data found for ${userName}, Stack: ${stackName || "All"}, Interval: ${interval}. Skipping.`);
            return;
        }

        // **Group and Calculate Averages**
        const stackGroups = data.reduce((acc, entry) => {
            // Destructure stackData to remove stationType and stackName from parameters
            const { stackName, stationType, ...parameters } = entry.stackData;
            if (!acc.parameters) acc.parameters = {};
            Object.entries(parameters).forEach(([key, value]) => {
                value = parseFloat(value);
                if (!isNaN(value)) {  
                    acc.parameters[key] = acc.parameters[key] || [];
                    acc.parameters[key].push(value);
                }
            });
            return acc;
        }, {});

        console.log(`🗂 Grouped Data Before Averaging:`, JSON.stringify(stackGroups, null, 2));

        // **Compute Averages**
        const averagedParameters = Object.entries(stackGroups.parameters).reduce((acc, [key, values]) => {
            const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
            acc[key] = parseFloat(avg.toFixed(2));
            return acc;
        }, {});

        console.log(`✅ Computed Averages for ${userName}, Stack: ${stackName || "All"}:`, JSON.stringify(averagedParameters, null, 2));

        // Determine the stationType for the saved average.
        // If a stackName is provided, we take the stationType from the first record.
        // Otherwise, label it as "effluent/emmision".
        const stationTypeForAverage = stackName ? data[0].stackData.stationType : 'effluent/emmision';

        // **Create and Save the Average Entry**
        const averageEntry = new IotDataAverage({
            userName,
            product_id,
            interval,
            intervalType: interval,
            date: nowIST.clone().subtract(interval === 'day' ? 1 : 0, 'day').format('DD/MM/YYYY'),
            timestamp: nowIST.clone().subtract(interval === 'day' ? 1 : 0, 'day').toDate(),
            stackData: [{
                stackName: stackName || "All",
                stationType: stationTypeForAverage,
                parameters: averagedParameters,
            }],
        });

        await averageEntry.save();
        console.log(`✅ Successfully Saved Average Data for ${userName}, Stack: ${stackName || "All"}, Interval: ${interval}`);

    } catch (error) {
        console.error(`❌ Error Saving Averages for ${userName}, Stack: ${stackName}, Interval: ${interval}:`, error);
    }
};


const getValidParameters = (parameters) => {
    const validParams = {};
    for (const [key, value] of parameters.entries()) {
        if (!key.startsWith('$')) { // Exclude keys that start with '$'
            validParams[key] = value;
        }
    }
    return validParams;
};
const calculateDailyOrMonthlyAverages = async (interval, startTime, endTime) => {
    console.log(`⏳ Running ${interval} average calculation from ${startTime} to ${endTime}`);

    const users = await IotDataAverage.distinct('userName', { interval: 'hour' });

    for (const userName of users) {
        const productIds = await IotDataAverage.distinct('product_id', { userName, interval: 'hour' });

        for (const product_id of productIds) {
            const stackNames = await IotDataAverage.aggregate([
                { $match: { userName, product_id, interval: 'hour' } },
                { $unwind: '$stackData' },
                { $group: { _id: '$stackData.stackName' } },
            ]).then(result => result.map(item => item._id));

            for (const stackName of stackNames) {
                const data = await IotDataAverage.find({
                    userName,
                    product_id,
                    'stackData.stackName': stackName,
                    interval: interval === 'day' ? 'hour' : 'day',
                    timestamp: { $gte: new Date(startTime), $lt: new Date(endTime) },
                });

                if (data.length === 0) {
                    console.log(`⚠️ No data found for ${userName}, Stack: ${stackName}, Interval: ${interval}. Skipping.`);
                    continue;
                }

                console.log(`📊 Fetched ${data.length} entries for ${userName}, Stack: ${stackName}`);

                // Calculate averages
                const parameters = {};
                data.forEach(entry => {
                    entry.stackData.forEach(stack => {
                        const validParams = getValidParameters(stack.parameters); // Filter out internal properties
                        Object.entries(validParams).forEach(([key, value]) => {
                            if (typeof value !== 'number' || isNaN(value)) {
                                console.warn(`⚠️ Invalid value for ${userName}, Stack: ${stackName}, Parameter: ${key}. Value: ${value}. Skipping.`);
                                value = 0; // Default to 0 for invalid values
                            }
                            parameters[key] = parameters[key] || [];
                            parameters[key].push(value);
                        });
                    });
                });

                // Compute the final average
                const averagedParameters = Object.entries(parameters).reduce((acc, [key, values]) => {
                    if (values.length === 0) {
                        acc[key] = 0;
                    } else {
                        const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
                        acc[key] = parseFloat(avg.toFixed(2));
                    }
                    return acc;
                }, {});

                // Ensure valid structure before saving
                if (Object.keys(averagedParameters).length === 0) {
                    console.log(`⚠️ No valid parameters for ${userName}, Stack: ${stackName}. Skipping save.`);
                    continue;
                }

                const averageEntry = new IotDataAverage({
                    userName,
                    product_id,
                    interval,
                    intervalType: interval,
                    dateAndTime: moment(startTime).tz('Asia/Kolkata').format('DD/MM/YYYY HH:mm'),
                    timestamp: new Date(startTime),
                    stackData: [{
                        stackName,
                        parameters: new Map(Object.entries(averagedParameters)), // Convert to Map
                    }],
                });

                try {
                    await averageEntry.save();
                    console.log(`✅ Saved ${interval} average data for ${userName}, Stack: ${stackName}`);
                } catch (error) {
                    console.error(`❌ Error saving ${interval} average for ${userName}, Stack: ${stackName}:`, error);
                }
            }
        }
    }
};


const moveDailyAveragesToS3 = async () => {
    console.log("\n📂 Moving Daily Averages to S3...");

    const nowIST = moment().tz('Asia/Kolkata').subtract(2, 'day').startOf('day').toDate();

    try {
        // Fetch daily averages older than 1 day
        const oldDailyAverages = await IotDataAverage.find({ 
            interval: 'day', 
            timestamp: { $lt: nowIST }
        }).lean();

        if (oldDailyAverages.length === 0) {
            console.log("⚠️ No old daily average data found to move.");
            return;
        }

        // Convert data to JSON
        const jsonData = JSON.stringify(oldDailyAverages, null, 2);

        // Upload to S3
        const params = {
            Bucket: process.env.AWS_S3_BUCKET_NAME, // Replace with your bucket name
            Key: `average_data/daily_average_${moment().tz('Asia/Kolkata').format('YYYY-MM-DD')}.json`,
            Body: jsonData,
            ContentType: 'application/json',
        };

        await s3.upload(params).promise();
        console.log("✅ Daily Averages Uploaded to S3 Successfully!");

        // Delete from MongoDB after successful upload
        await IotDataAverage.deleteMany({ interval: 'day', timestamp: { $lt: nowIST } });
        console.log("🗑 Old Daily Averages Deleted from MongoDB.");
    } catch (error) {
        console.error("❌ Error moving daily averages to S3:", error);
    }
};

const scheduleAveragesCalculation = () => {
    // Hourly Average Calculation at 55th minute of every hour
    cron.schedule('55 * * * *', async () => {
        console.log("⏳ Running Hourly Average Calculation...");
        const now = moment().tz('Asia/Kolkata');

        const users = await IotData.distinct('userName');
        for (const userName of users) {
            const productIds = await IotData.distinct('product_id', { userName });
            for (const product_id of productIds) {
                const stackNames = await IotData.aggregate([
                    { $match: { userName, product_id } },
                    { $unwind: '$stackData' },
                    { $group: { _id: '$stackData.stackName' } },
                ]).then(result => result.map(item => item._id));

                for (const stackName of stackNames) {
                    await calculateAverages(userName, product_id, stackName, 'hour');
                }
            }
        }
    });

    // Daily Average Calculation before midnight (11:55 PM)
    cron.schedule('55 23 * * *', async () => {
        console.log("⏳ Running Daily Average Calculation...");
    
        const nowIST = moment().tz('Asia/Kolkata').startOf('day'); // Set to today
        const startTime = nowIST.toDate(); // Today 00:00:00
        const endTime = nowIST.clone().endOf('day').toDate(); // Today 23:59:59
    
        await calculateDailyOrMonthlyAverages('day', startTime, endTime);
    });
    
    
    // Move Yesterday's Hourly Data to S3 at 01:00 AM
    cron.schedule('0 1 * * *', async () => {
        console.log("⏳ Running Scheduled Data Transfer to S3...");
        await moveHourlyAveragesToS3();
    });
};

// Function to Move Data to S3
const moveHourlyAveragesToS3 = async () => {
    try {
        const yesterday = moment().tz('Asia/Kolkata').subtract(1, 'day').format('DD/MM/YYYY');

        // Fetch all hourly data for the previous day
        const hourlyData = await IotDataAverage.find({
            interval: 'hour',
            date: yesterday
        });

        if (hourlyData.length === 0) {
            console.log(`⚠️ No hourly data found for ${yesterday}. Skipping S3 upload.`);
            return;
        }

        console.log(`📤 Uploading ${hourlyData.length} hourly averages to S3...`);
        await uploadToS3(hourlyData, `hourly-averages/${yesterday}.json`);

        // **Delete Data from MongoDB After Successful Upload**
        await IotDataAverage.deleteMany({ interval: 'hour', date: yesterday });

        console.log(`✅ Successfully moved and deleted hourly averages for ${yesterday} from MongoDB.`);
    } catch (error) {
        console.error("❌ Error moving hourly averages to S3:", error);
    }
};

// Function to Upload Data to S3
const uploadToS3 = async (data, filePath) => {
    try {
        const s3 = new AWS.S3();
        await s3.putObject({
            Bucket: "your-s3-bucket-name",
            Key: filePath,
            Body: JSON.stringify(data),
            ContentType: "application/json"
        }).promise();
        console.log(`✅ Successfully uploaded ${filePath} to S3.`);
    } catch (error) {
        console.error("❌ Error uploading data to S3:", error);
    }
};


const calculateAverageForTimeRange = async (req, res) => {
    const { userName, stackName } = req.params;
    const { startDate, endDate } = req.query; // expected format: DD-MM-YYYY
  
    try {
      // Validate required parameters
      if (!userName || !stackName || !startDate || !endDate) {
        return res.status(400).json({ message: 'Missing required query parameters: userName, stackName, startDate, endDate' });
      }
  
      // Parse start and end dates using DD-MM-YYYY format and set boundaries for the full day
      const startMoment = moment(startDate, 'DD-MM-YYYY', true).startOf('day');
      const endMoment = moment(endDate, 'DD-MM-YYYY', true).endOf('day');
  
      if (!startMoment.isValid() || !endMoment.isValid()) {
        return res.status(400).json({ message: 'Invalid date format. Use DD-MM-YYYY.' });
      }
  
      // For logging, convert to ISO (YYYY-MM-DD)
      const isoStart = startMoment.format('YYYY-MM-DD');
      const isoEnd = endMoment.format('YYYY-MM-DD');
      console.log(`🔍 Fetching average data for ${userName}, stack: ${stackName} from ${isoStart} to ${isoEnd}`);
  
      // Fetch data from S3
      const allData = await fetchAverageDataFromS3();
      if (!allData || allData.length === 0) {
        return res.status(404).json({ message: 'No data available in S3.' });
      }
  
      // Filter data for the specified user, stack, and timestamp range.
      // Here we assume each entry.timestamp is stored as an ISO string (e.g., "2025-03-11T00:25:00.376Z").
      const filteredData = allData.filter(entry => {
        const entryMoment = moment(entry.timestamp);
        const userMatch = entry.userName.trim().toLowerCase() === userName.trim().toLowerCase();
        const stackMatch = entry.stackData.some(
          stack => stack.stackName.trim().toLowerCase() === stackName.trim().toLowerCase()
        );
        return userMatch && stackMatch && entryMoment.isValid() && entryMoment.isBetween(startMoment, endMoment, null, '[]');
      });
  
      if (filteredData.length === 0) {
        return res.status(404).json({
          message: `No average data found for userName: ${userName}, stackName: ${stackName}, and the specified time range.`,
        });
      }
  
      // Aggregate parameter values (only considering non-negative numbers)
      const parametersSum = {};
      const parametersCount = {};
  
      filteredData.forEach(entry => {
        entry.stackData.forEach(stack => {
          if (stack.stackName.trim().toLowerCase() === stackName.trim().toLowerCase()) {
            Object.entries(stack.parameters).forEach(([key, value]) => {
              if (typeof value === 'number' && !isNaN(value) && value >= 0) {
                parametersSum[key] = (parametersSum[key] || 0) + value;
                parametersCount[key] = (parametersCount[key] || 0) + 1;
              }
            });
          }
        });
      });
  
      // Calculate averages and round to 2 decimal places
      const averagedParameters = Object.entries(parametersSum).reduce((acc, [key, sum]) => {
        const count = parametersCount[key] || 1;
        acc[key] = parseFloat((sum / count).toFixed(2));
        return acc;
      }, {});
  
      console.log(`✅ Computed Averages for ${userName}, Stack: ${stackName}:`, JSON.stringify(averagedParameters, null, 2));
  
      res.status(200).json({
        success: true,
        message: `Averages calculated successfully for ${userName}, stack: ${stackName} from ${isoStart} to ${isoEnd}`,
        data: averagedParameters,
        totalEntries: filteredData.length,
      });
    } catch (error) {
      console.error('❌ Error calculating averages:', error);
      res.status(500).json({ message: 'Error calculating averages from S3.', error: error.message });
    }
  };
  


//yesteradys average
const calculateYesterdayAverage = async (req, res) => {
    const { userName, stackName } = req.params;

    try {
        // ✅ Get yesterday's date formatted as DD/MM/YYYY
        const yesterdayFormatted = moment().tz('Asia/Kolkata').subtract(1, 'days').format('DD/MM/YYYY');

        console.log(`📌 Calculating Yesterday's Average Data for ${userName}, Stack: ${stackName}, Date: ${yesterdayFormatted}`);

        // ✅ Fetch data from MongoDB
        const mongoData = await IotDataAverage.find({
            userName,
            'stackData.stackName': stackName,
            interval: 'hour',
            date: yesterdayFormatted,
        }).lean();

        console.log(`📊 MongoDB: Fetched ${mongoData.length} hourly records for yesterday.`);

        // ✅ Fetch data from S3
        const s3Data = await fetchAverageDataFromS3();
        const filteredS3Data = s3Data.filter(entry => 
            entry.userName === userName &&
            entry.stackData.some(stack => stack.stackName === stackName) &&
            entry.date === yesterdayFormatted &&
            entry.interval === 'hour'
        );

        console.log(`📥 S3: Fetched ${filteredS3Data.length} hourly records for yesterday.`);

        // ✅ Combine data from MongoDB and S3
        const combinedData = [...mongoData, ...filteredS3Data];

        if (combinedData.length === 0) {
            return res.status(404).json({
                success: false,
                message: `No hourly data found for ${userName}, Stack: ${stackName} on ${yesterdayFormatted}.`,
            });
        }

        // ✅ Extract product_id from the first valid entry
        const product_id = combinedData[0].product_id || "UNKNOWN_PRODUCT";

        // ✅ Aggregate Data (Compute Averages - Ignore Negative Values)
        const parametersSum = {};
        const parametersCount = {};

        combinedData.forEach(entry => {
            entry.stackData.forEach(stack => {
                if (stack.stackName === stackName) {
                    Object.entries(stack.parameters).forEach(([key, value]) => {
                        if (typeof value === 'number' && !isNaN(value) && value >= 0) { // Ignore negative values
                            parametersSum[key] = (parametersSum[key] || 0) + value;
                            parametersCount[key] = (parametersCount[key] || 0) + 1;
                        }
                    });
                }
            });
        });

        // ✅ Compute the final averages per parameter (ignoring negatives)
        const averagedParameters = Object.entries(parametersSum).reduce((acc, [key, sum]) => {
            const count = parametersCount[key] || 1;
            acc[key] = parseFloat((sum / count).toFixed(2));
            return acc;
        }, {});

        console.log(`✅ Computed Averages (Ignoring Negative Values):`, JSON.stringify(averagedParameters, null, 2));

        // ✅ Save Yesterday's Average Data in MongoDB
        const averageEntry = new IotDataAverage({
            userName,
            product_id,
            interval: 'day',
            intervalType: 'day', // ✅ Required Field
            date: yesterdayFormatted,
            timestamp: moment().tz('Asia/Kolkata').subtract(1, 'days').startOf('day').toDate(),
            stackData: [{ stackName, parameters: averagedParameters }],
        });

        await averageEntry.save();
        console.log(`✅ Successfully Saved Yesterday's Average Data for ${userName}, Stack: ${stackName}`);

        res.status(200).json({
            success: true,
            message: `Yesterday's average data calculated successfully for ${userName}, Stack: ${stackName}.`,
            data: averageEntry,
        });

    } catch (error) {
        console.error('❌ Error calculating yesterday\'s average data:', error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error while calculating yesterday's average data.",
            error: error.message,
        });
    }
};



const getHourlyDataForDailyInterval = async (req, res) => {
    const { userName } = req.params;

    try {
        // Get the current date in IST
        const nowIST = moment().tz('Asia/Kolkata');

        // Calculate start and end time for the current day
        const startTime = nowIST.clone().startOf('day').toDate(); // Start of the day (00:00:00)
        const endTime = nowIST.clone().endOf('day').toDate(); // End of the day (23:59:59)

        // Fetch hourly data for the specified day
        const data = await IotDataAverage.find({
            userName,
            interval: 'hour', // Fetch hourly data
            timestamp: { $gte: startTime, $lte: endTime },
        });

        if (data.length === 0) {
            return res.status(404).json({ message: 'No hourly data found for the specified day.' });
        }

        // Return the fetched data
        res.status(200).json(data);
    } catch (error) {
        console.error(`❌ Error fetching hourly data for ${userName}:`, error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
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
const fetchAverageDataFromS3 = async () => {
    try {
        const key = 'average_data/averageData.json';  // S3 file path

        console.log(`Fetching data from S3 with key: ${key}`);
        const params = {
            Bucket: 'ems-ebhoom-bucket', // Replace with your bucket name
            Key: key
        };

        const s3Object = await s3.getObject(params).promise();
        const fileContent = s3Object.Body.toString('utf-8');

        // Parse JSON content
        const jsonData = JSON.parse(fileContent);

        console.log("Fetched S3 Average Data Length:", jsonData.length);

        return jsonData;
    } catch (error) {
        console.error('Error fetching data from S3:', error);
        throw new Error('Failed to fetch average data from S3');
    }
};



// Controller function to fetch all average data
const getAllAverageData = async (req, res) => {
    try {
        const data = await fetchAverageDataFromS3(); // Fetch data from the S3 bucket

        if (!data || data.length === 0) {
            return res.status(404).json({ message: 'No average data found in S3.' });
        }

        res.status(200).json({
            success: true,
            message: 'All average data fetched successfully from S3',
            data
        });
    } catch (error) {
        console.error('Error fetching all average data from S3:', error);
        res.status(500).json({ message: 'Error fetching average data from S3.', error });
    }
};

// Controller function to fetch average data by userName
const findAverageDataUsingUserName = async (req, res) => {
    const { userName } = req.params;

    try {
        const data = await fetchAverageDataFromS3(); // Fetch data from the S3 bucket

        // Filter the data for the specific userName
        const filteredData = data.filter(entry => entry.userName === userName);

        if (!filteredData || filteredData.length === 0) {
            return res.status(404).json({ message: `No average data found for userName: ${userName} in S3.` });
        }

        res.status(200).json({
            success: true,
            message: `Average data for userName ${userName} fetched successfully from S3`,
            data: filteredData
        });
    } catch (error) {
        console.error(`Error fetching average data for userName ${userName} from S3:`, error);
        res.status(500).json({ message: 'Error fetching average data from S3.', error });
    }
};

const findAverageDataUsingUserNameAndStackName = async (req, res) => {
    const { userName, stackName } = req.params;

    try {
        const data = await fetchAverageDataFromS3(); // Fetch all data from the S3 bucket

        // Filter the data for the specific userName and stackName
        const filteredData = data
            .filter(entry => entry.userName === userName)
            .map(entry => ({
                ...entry,
                stackData: entry.stackData.filter(stack => stack.stackName === stackName),
            }))
            .filter(entry => entry.stackData.length > 0); // Ensure only non-empty entries are returned

        if (!filteredData || filteredData.length === 0) {
            return res.status(404).json({
                message: `No average data found for userName: ${userName} and stackName: ${stackName} in S3.`,
            });
        }

        res.status(200).json({
            success: true,
            message: `Average data for userName ${userName} and stackName ${stackName} fetched successfully from S3`,
            data: filteredData,
        });
    } catch (error) {
        console.error(`Error fetching average data for userName ${userName} and stackName ${stackName} from S3:`, error);
        res.status(500).json({ message: 'Error fetching average data from S3.', error });
    }
};
const findAverageDataUsingUserNameAndStackNameAndIntervalType = async (req, res) => {
    const { userName, stackName, intervalType } = req.params;

    try {
        console.log(`🔍 Fetching average data for user: ${userName}, stack: ${stackName}, interval: ${intervalType}`);

        // Fetch data from MongoDB
        const mongoData = await IotDataAverage.find({
            userName,
            'stackData.stackName': stackName,
            intervalType
        })
        .sort({ timestamp: -1 }) // Sort by newest first
        .limit(24) // Fetch max 24 records
        .lean();

        console.log(`📥 MongoDB: Found ${mongoData.length} records`);

        // Fetch data from S3
        const s3Data = await fetchAverageDataFromS3();

        // Filter S3 data for the user, stack, and intervalType
        const filteredS3Data = s3Data
            .filter(entry => entry.userName === userName && entry.intervalType === intervalType)
            .map(entry => ({
                ...entry,
                stackData: entry.stackData.filter(stack => stack.stackName === stackName),
            }))
            .filter(entry => entry.stackData.length > 0);

        console.log(`📥 S3: Found ${filteredS3Data.length} records`);

        // Merge both MongoDB and S3 data
        const combinedData = [...mongoData, ...filteredS3Data];

        // Sort merged data by timestamp (latest first)
        combinedData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Get only the last 24 records
        const latestData = combinedData.slice(0, 24);

        if (latestData.length === 0) {
            return res.status(404).json({
                message: `❌ No average data found for userName: ${userName}, stackName: ${stackName}, intervalType: ${intervalType}.`,
            });
        }

        res.status(200).json({
            status: 200,
            success: true,
            message: `✅ Last 24 average data points fetched successfully for user: ${userName}, stack: ${stackName}, interval type: ${intervalType}.`,
            data: latestData,
        });

    } catch (error) {
        console.error(`❌ Error fetching average data for user ${userName}, stack ${stackName}, interval ${intervalType}:`, error);
        res.status(500).json({ message: 'Error fetching average data.', error });
    }
};


const findAverageDataUsingUserNameAndStackNameAndIntervalTypeWithTimeRange = async (req, res) => {
    const { userName, stackName, intervalType } = req.params;
    const { startTime, endTime, page = 1, limit = 10 } = req.query; // Include page and limit for pagination

    try {
        // Parse start and end dates
        const startDate = moment(startTime, 'DD-MM-YYYY', true).format('YYYY-MM-DD');
        const endDate = moment(endTime, 'DD-MM-YYYY', true).format('YYYY-MM-DD');

        if (!startDate || !endDate || !moment(startDate).isValid() || !moment(endDate).isValid()) {
            return res.status(400).json({ message: 'Invalid start or end date format. Use DD-MM-YYYY.' });
        }

        // Fetch all average data from S3
        const allData = await fetchAverageDataFromS3();
        console.log('Fetched S3 Average Data Length:', allData.length);

        // Filter data for the specific userName, intervalType, and date range
        const filteredData = allData
            .filter(entry => {
                const dateValid = moment(entry.dateAndTime, 'DD/MM/YYYY').isBetween(startDate, endDate, 'day', '[]');
                const userMatch = entry.userName.trim().toLowerCase() === userName.trim().toLowerCase();
                const intervalMatch = entry.intervalType.trim().toLowerCase() === intervalType.trim().toLowerCase();
                return userMatch && intervalMatch && dateValid;
            })
            .map(entry => ({
                ...entry,
                stackData: entry.stackData.filter(stack => stack.stackName.trim().toLowerCase() === stackName.trim().toLowerCase()),
            }))
            .filter(entry => entry.stackData.length > 0); // Ensure only non-empty stackData entries

        if (!filteredData || filteredData.length === 0) {
            return res.status(404).json({
                message: `No average data found for userName: ${userName}, stackName: ${stackName}, intervalType: ${intervalType}, and the specified time range in S3.`,
            });
        }

        // Implement pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);

        const paginatedData = filteredData.slice(startIndex, endIndex);

        res.status(200).json({
            status: 200,
            success: true,
            message: `Average data fetched successfully from S3 for user ${userName}, stack ${stackName}, interval type ${intervalType}, and time range.`,
            data: paginatedData,
            pagination: {
                totalRecords: filteredData.length,
                totalPages: Math.ceil(filteredData.length / limit),
                currentPage: parseInt(page),
                limit: parseInt(limit),
            },
        });
    } catch (error) {
        console.error(
            `Error fetching data for user ${userName}, stack ${stackName}, interval type ${intervalType}, and time range from S3:`,
            error
        );
        res.status(500).json({
            message: 'Error fetching average data from S3.',
            error: error.message,
        });
    }
};


const fetchLastEntryOfEachDate = async (req, res) => {
    const { userName, stackName, intervalType } = req.params;
    const { startTime, endTime } = req.query;

    try {
        // Validate query parameters
        if (!startTime || !endTime || !userName || !stackName || !intervalType) {
            return res.status(400).json({ message: 'Missing required parameters.' });
        }

        // Parse and validate start and end dates
        const startDate = moment(startTime, 'DD-MM-YYYY', true).startOf('day');
        const endDate = moment(endTime, 'DD-MM-YYYY', true).endOf('day');

        if (!startDate.isValid() || !endDate.isValid()) {
            return res.status(400).json({ message: 'Invalid date format. Use DD-MM-YYYY.' });
        }

        // Debug log
        console.log(`Fetching data for user: ${userName}, stack: ${stackName}, interval: ${intervalType}`);
        console.log(`Date range: ${startDate.format()} to ${endDate.format()}`);

        // Fetch data from S3
        const allData = await fetchAverageDataFromS3();

        if (!allData || allData.length === 0) {
            return res.status(404).json({ message: 'No data available in S3.' });
        }

        // Filter data by userName, stackName, intervalType, and date range
        const filteredData = allData
            .filter(entry => {
                const entryDate = moment(entry.dateAndTime, 'DD/MM/YYYY');
                const userMatch = entry.userName.trim().toLowerCase() === userName.trim().toLowerCase();
                const intervalMatch = entry.intervalType.trim().toLowerCase() === intervalType.trim().toLowerCase();
                const stackMatch = entry.stackData.some(
                    stack => stack.stackName.trim().toLowerCase() === stackName.trim().toLowerCase()
                );
                return userMatch && intervalMatch && stackMatch && entryDate.isBetween(startDate, endDate, 'day', '[]');
            });

        if (filteredData.length === 0) {
            return res.status(404).json({
                message: `No data found for userName: ${userName}, stackName: ${stackName}, intervalType: ${intervalType}, and specified time range.`,
            });
        }

        // Group data by date and get the last entry for each date
        const groupedByDate = filteredData.reduce((acc, entry) => {
            const date = moment(entry.dateAndTime, 'DD/MM/YYYY').format('YYYY-MM-DD');
            if (!acc[date] || moment(entry.timestamp).isAfter(acc[date].timestamp)) {
                acc[date] = entry;
            }
            return acc;
        }, {});

        const result = Object.values(groupedByDate);

        // Debug result
        console.log(`Result length: ${result.length}`);
        console.log('Sample result:', result.slice(0, 3));

        res.status(200).json({
            success: true,
            message: `Last entry of each date fetched successfully for userName: ${userName}, stackName: ${stackName}, intervalType: ${intervalType}.`,
            data: result,
        });
    } catch (error) {
        console.error('Error fetching last entry of each date:', error);
        res.status(500).json({
            message: 'Internal Server Error while fetching last entry of each date.',
            error: error.message,
        });
    }
};

const downloadAverageDataWithUserNameStackNameAndIntervalWithTimeRange = async (req, res) => {
    try {
        const { userName, stackName, intervalType } = req.params;
        const { startTime, endTime, format } = req.query;

        if (!userName || !stackName || !intervalType || !startTime || !endTime || !format) {
            return res.status(400).json({ success: false, message: 'Missing required query parameters.' });
        }

        // ✅ Corrected Date Parsing with Timezone (Asia/Kolkata)
        const startDate = moment.tz(startTime, 'DD-MM-YYYY', 'Asia/Kolkata').startOf('day');
        const endDate = moment.tz(endTime, 'DD-MM-YYYY', 'Asia/Kolkata').endOf('day');

        console.log("Start Date (ISO):", startDate.toISOString());
        console.log("End Date (ISO):", endDate.toISOString());

        if (!startDate.isValid() || !endDate.isValid()) {
            return res.status(400).json({ success: false, message: 'Invalid date format. Use "DD-MM-YYYY".' });
        }

        // ✅ Fetch MongoDB Data (Case Insensitive)
        const mongoData = await IotDataAverage.find({
            userName: new RegExp(`^${userName.trim()}$`, 'i'),
            'stackData.stackName': new RegExp(`^${stackName.trim()}$`, 'i'),
            intervalType: new RegExp(`^${intervalType.trim()}$`, 'i'),
            timestamp: { $gte: startDate.toDate(), $lte: endDate.toDate() },
        }).lean();

        console.log('Fetched MongoDB Data Length:', mongoData.length);

        // ✅ Fetch S3 Data
        const s3Data = await fetchAverageDataFromS3();
        console.log('Fetched S3 Data Length:', s3Data.length);

        // ✅ Filter S3 Data
        const filteredS3Data = s3Data.filter(entry => {
            const entryDate = moment.tz(entry.timestamp, ['YYYY-MM-DDTHH:mm:ss.SSSZ', 'DD/MM/YYYY HH:mm'], 'Asia/Kolkata');
            console.log("S3 Entry Date:", entryDate.format("YYYY-MM-DD HH:mm:ss"));

            return (
                entryDate.isValid() &&
                entryDate.isBetween(startDate, endDate, 'day', '[]') &&
                entry.userName.trim().toLowerCase() === userName.trim().toLowerCase() &&
                entry.intervalType.trim().toLowerCase() === intervalType.trim().toLowerCase()
            );
        });

        console.log('Filtered S3 Data Length:', filteredS3Data.length);

        // ✅ Combine Data from MongoDB and S3
        const combinedData = [...mongoData, ...filteredS3Data].sort((a, b) => {
            const dateA = moment.tz(a.timestamp || a.dateAndTime, ['YYYY-MM-DDTHH:mm:ss.SSSZ', 'DD/MM/YYYY HH:mm'], 'Asia/Kolkata');
            const dateB = moment.tz(b.timestamp || b.dateAndTime, ['YYYY-MM-DDTHH:mm:ss.SSSZ', 'DD/MM/YYYY HH:mm'], 'Asia/Kolkata');
            return dateA.diff(dateB);
        });

        console.log("Combined Data Length:", combinedData.length);

        if (combinedData.length === 0) {
            return res.status(404).json({ success: false, message: 'No data found for the specified criteria.' });
        }

        // ✅ Extract Parameters from Stack Data
        const stackKeys = Object.keys(combinedData[0].stackData[0]?.parameters || {}).filter(key => key !== '_id');

        if (format === 'csv') {
            // ✅ CSV Export
            const fields = ['Date', 'Time', 'Stack Name', ...stackKeys];

            const csvData = combinedData.flatMap(item =>
                item.stackData.map(stack => {
                    let dateAndTime = moment.tz(item.timestamp, ['YYYY-MM-DDTHH:mm:ss.SSSZ', 'DD/MM/YYYY HH:mm'], 'Asia/Kolkata');

                    return {
                        Date: dateAndTime.format('DD-MM-YYYY'),
                        Time: dateAndTime.format('HH:mm:ss'),
                        'Stack Name': stack.stackName,
                        ...stack.parameters,
                    };
                })
            );

            const parser = new Parser({ fields });
            const csv = parser.parse(csvData);

            res.header('Content-Type', 'text/csv');
            res.attachment(`${userName}_${stackName}_average_data.csv`);
            return res.send(csv);
        } else if (format === 'pdf') {
            // ✅ PDF Export
            const doc = new PDFDocument();
            res.header('Content-Type', 'application/pdf');
            res.attachment(`${userName}_${stackName}_average_data.pdf`);

            doc.pipe(res);
            doc.fontSize(20).text('Average Data Report', { align: 'center' });
            doc.fontSize(12).text(`User Name: ${userName}`);
            doc.fontSize(12).text(`Stack Name: ${stackName}`);
            doc.fontSize(12).text(`Interval Type: ${intervalType}`);
            doc.fontSize(12).text(`Date Range: ${startTime} - ${endTime}`);
            doc.moveDown();

            combinedData.forEach(item => {
                item.stackData.forEach(stack => {
                    let dateAndTime = moment.tz(item.timestamp, ['YYYY-MM-DDTHH:mm:ss.SSSZ', 'DD/MM/YYYY HH:mm'], 'Asia/Kolkata');

                    doc.fontSize(12).text(`Date: ${dateAndTime.format('DD-MM-YYYY')}`);
                    doc.text(`Time: ${dateAndTime.format('HH:mm:ss')}`);
                    doc.fontSize(12).text(`Stack: ${stack.stackName}`, { underline: true });

                    const keys = Object.keys(stack.parameters || {});
                    const tableData = keys.map(key => `${key}: ${stack.parameters[key]}`).join(', ');

                    doc.text(tableData);
                    doc.moveDown();
                });
            });

            doc.end();
        } else {
            return res.status(400).json({ success: false, message: 'Invalid format requested. Use "csv" or "pdf".' });
        }
    } catch (error) {
        console.error('Error fetching or processing data:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};




const getTodayLastAverageDataByStackName = async (req, res) => {
    const { userName, stackName } = req.params;

    try {
        // Validate input
        if (!userName || !stackName) {
            return res.status(400).json({ success: false, message: 'userName and stackName are required.' });
        }

        // Define today's date range in IST
        const startOfToday = moment().tz('Asia/Kolkata').startOf('day').toDate();
        const endOfToday = moment().tz('Asia/Kolkata').endOf('day').toDate();

        // Fetch data from MongoDB
        const mongoData = await IotDataAverage.find({
            userName,
            'stackData.stackName': stackName,
            timestamp: { $gte: startOfToday, $lte: endOfToday },
        })
            .sort({ timestamp: -1 })
            .limit(1)
            .lean();

        // Fetch data from S3
        const s3Data = await fetchAverageDataFromS3();
        const filteredS3Data = s3Data
            .filter(entry => {
                const entryDate = new Date(entry.timestamp);
                return (
                    entry.userName === userName &&
                    entry.stackData.some(stack => stack.stackName === stackName) &&
                    entryDate >= startOfToday && entryDate <= endOfToday
                );
            })
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Sort S3 data by timestamp

        // Combine results and select the latest entry
        const combinedData = [...mongoData, ...filteredS3Data];
        const latestData = combinedData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

        if (!latestData) {
            return res.status(404).json({
                success: false,
                message: `No average data found for userName: ${userName} and stackName: ${stackName} today.`,
            });
        }

        res.status(200).json({
            success: true,
            message: `Last average data for userName: ${userName} and stackName: ${stackName} fetched successfully.`,
            data: latestData,
        });
    } catch (error) {
        console.error('Error fetching last average IoT data:', error);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error while fetching last average data.',
            error: error.message,
        });
    }
};

// Function to get all hourly averages for a user on a specific date
const getHourlyAveragesByDate = async (req, res) => {
    try {
        const { userName, day, month, year } = req.params;
        const formattedDate = `${day}/${month}/${year}`; // Expected format: DD/MM/YYYY

        console.log(`📥 Fetching hourly data for user: ${userName} on date: ${formattedDate}`);

        // Debugging: Check the query parameters
        console.log(`🔍 Querying MongoDB with: { userName: "${userName}", interval: "hour", date: "${formattedDate}" }`);

        // Fetch hourly averages from MongoDB
        let hourlyData = await IotDataAverage.find({
            userName,
            interval: "hour",
            date: formattedDate,
        }).lean();

        console.log(`🔍 MongoDB Query Result: ${hourlyData.length} records found`);

        // If no data is found in MongoDB, fetch from S3
        if (hourlyData.length === 0) {
            console.log(`⚠️ No hourly data found in MongoDB for ${userName} on ${formattedDate}. Checking S3...`);

            const s3Data = await fetchAverageDataFromS3(); // Fetch all data from S3

            // Debugging: Check if data from S3 is undefined or missing required fields
            if (!s3Data || s3Data.length === 0) {
                console.log(`⚠️ No data found in S3 for user: ${userName} on ${formattedDate}`);
            }

            // Filter the S3 data for the specific user and date (Ensure dateAndTime exists)
            hourlyData = s3Data.filter(entry => 
                entry.userName === userName &&
                entry.date && 
                entry.date.startsWith(formattedDate) // Ensure dateAndTime is defined before using startsWith
            );

            console.log(`📥 S3 Query Result: ${hourlyData.length} records found`);
        }

        // If no data is found in both MongoDB and S3, return an error
        if (hourlyData.length === 0) {
            return res.status(404).json({
                success: false,
                message: `No hourly data found for ${userName} on ${formattedDate}`,
            });
        }

        res.status(200).json({
            success: true,
            count: hourlyData.length,
            data: hourlyData,
        });

    } catch (error) {
        console.error("❌ Error fetching hourly data:", error);
        res.status(500).json({
            success: false,
            message: "Server error while fetching hourly averages",
            error: error.message,
        });
    }
};


//findAverageDataUsingUserNameAndStackNameAndIntervalType

const getDailyAveragesLast20Days = async (req, res) => {
  const { userName, stackName } = req.params;

  try {
    // Calculate cutoff: start of day, 19 days ago (so that today + 19 previous days = 20 days total)
    const cutoff = moment().tz('Asia/Kolkata').startOf('day').subtract(19, 'days').toDate();

    // Query MongoDB
    const entries = await IotDataAverage.find({
      userName,
      interval: 'day',
      'stackData.stackName': stackName,
      timestamp: { $gte: cutoff },
    })
      .sort({ timestamp: 1 })    // oldest → newest
      .limit(20)                 // up to 20 records
      .lean();

    if (!entries.length) {
      return res.status(404).json({
        success: false,
        message: `No daily averages found for user "${userName}" and stack "${stackName}" in the last 20 days.`,
      });
    }

    res.json({
      success: true,
      message: `Fetched ${entries.length} daily averages for user "${userName}" and stack "${stackName}".`,
      data: entries,
    });
  } catch (err) {
    console.error('Error in getDailyAveragesLast20Days:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching daily averages.',
      error: err.message,
    });
  }
};

const getDailyAveragesByRange = async (req, res) => {
  const { userName, stackName } = req.params;
  const { startDate, endDate } = req.query; // expected DD-MM-YYYY

  if (!startDate || !endDate) {
    return res.status(400).json({
      success: false,
      message: 'Please provide startDate and endDate in DD-MM-YYYY format as query params'
    });
  }

  // parse and build JS Date range in IST
  const start = moment.tz(startDate, 'DD-MM-YYYY', 'Asia/Kolkata').startOf('day');
  const end   = moment.tz(endDate,   'DD-MM-YYYY', 'Asia/Kolkata').endOf('day');
  if (!start.isValid() || !end.isValid()) {
    return res.status(400).json({
      success: false,
      message: 'Invalid date format. Use DD-MM-YYYY.'
    });
  }

  try {
    // fetch all daily entries for this user/stack in range
    const entries = await IotDataAverage.find({
      userName,
      interval: 'day',
      'stackData.stackName': stackName,
      timestamp: { $gte: start.toDate(), $lte: end.toDate() },
    })
      .sort({ timestamp: 1 })
      .lean();

    if (!entries.length) {
      return res.status(404).json({
        success: false,
        message: `No daily averages found for ${userName}/${stackName} between ${startDate} and ${endDate}.`
      });
    }

    // map to an array of { date: 'YYYY-MM-DD', ...parameters }
    const result = entries.map(e => {
      const d = moment(e.timestamp).tz('Asia/Kolkata').format('YYYY-MM-DD');
      const params = e.stackData.find(s => s.stackName===stackName).parameters || {};
      return { date: d, ...params };
    });

    res.json({
      success: true,
      message: `Fetched ${result.length} days of data`,
      data: result
    });
  } catch (err) {
    console.error('getDailyAveragesByRange:', err);
    res.status(500).json({
      success: false,
      message: 'Server error fetching daily averages',
      error: err.message
    });
  }
};

module.exports = { calculateAverages, scheduleAveragesCalculation,findAverageDataUsingUserName,
    findAverageDataUsingUserNameAndStackName,getAllAverageData,findAverageDataUsingUserNameAndStackNameAndIntervalType,
    findAverageDataUsingUserNameAndStackNameAndIntervalTypeWithTimeRange,
    downloadAverageDataWithUserNameStackNameAndIntervalWithTimeRange,
    fetchLastEntryOfEachDate, getTodayLastAverageDataByStackName ,moveDailyAveragesToS3 , calculateYesterdayAverage,getHourlyDataForDailyInterval,getHourlyAveragesByDate,calculateAverageForTimeRange,
    getDailyAveragesLast20Days ,getDailyAveragesByRange
};
