const AWS = require('aws-sdk');
const moment = require("moment-timezone");
const cron = require('node-cron');
const DifferenceData = require('../models/differeneceData');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');
const HourlyData = require('../models/hourlyData');
const s3 = new AWS.S3(); // make sure AWS is configured properly

// Function to save the initial data (unchanged)
const saveInitialData = async () => {
try {
const today = moment().tz('Asia/Kolkata').format('DD/MM/YYYY');
const yesterday = moment().tz('Asia/Kolkata').subtract(1, 'day').format('DD/MM/YYYY');
const bucketName = 'ems-ebhoom-bucket';
    
const hourlyFileKey = 'hourly_data/hourlyData.json';
    const differenceFileKey = 'difference_data/hourlyDifferenceData.json';
let hourlyData = [];
    let existingDifferenceData = [];
  
// --- Step 1: Fetch S3 files ---
console.log('Fetching hourly data from S3...');
try {
const hourlyS3Object = await s3.getObject({ Bucket: bucketName, Key: hourlyFileKey }).promise();
hourlyData = JSON.parse(hourlyS3Object.Body.toString('utf-8'));
} catch (s3Error) {
if (s3Error.code !== 'NoSuchKey') {
        console.error("Error fetching hourly data, but will attempt to proceed:", s3Error);
      }
}

    console.log('Fetching existing difference data from S3...');
    try {
        const differenceS3Object = await s3.getObject({ Bucket: bucketName, Key: differenceFileKey }).promise();
        existingDifferenceData = JSON.parse(differenceS3Object.Body.toString('utf-8'));
    } catch (s3Error) {
        if (s3Error.code === 'NoSuchKey') {
            console.log('Difference data file not found. A new one will be created.');
        } else {
            throw s3Error; // Rethrow other critical errors
        }
    }
  
    // --- Step 2: Determine a unique set of all stacks to process ---
    const allStacks = new Map();

    // Add stacks that were active yesterday
    const yesterdayDifferenceRecords = existingDifferenceData.filter(rec => rec.date === yesterday);
    yesterdayDifferenceRecords.forEach(rec => {
        const key = `${rec.userName}_${rec.stackName}`;
        if (!allStacks.has(key)) {
            allStacks.set(key, { userName: rec.userName, stackName: rec.stackName, stationType: rec.stationType });
        }
    });

    // Add stacks active today (for new devices)
    const todaysHourlyData = hourlyData.filter(entry => entry.date === today);
    todaysHourlyData.forEach(entry => {
        entry.stacks.forEach(stack => {
            const key = `${entry.userName}_${stack.stackName}`;
            if (!allStacks.has(key)) {
                allStacks.set(key, { userName: entry.userName, stackName: stack.stackName, stationType: stack.stationType });
            }
        });
    });

    if (allStacks.size === 0) {
        console.log("No active stacks found from yesterday's difference data or today's hourly data. Nothing to do.");
        return;
    }

    // --- Step 3: Create new initial records for all identified stacks ---
    const newInitialRecords = [];
for (const [key, stackInfo] of allStacks.entries()) {
        const { userName, stackName, stationType } = stackInfo;
let initialEnergy = 0;
let initialCumulatingFlow = 0;

        // Find the latest record for this stack from yesterday
        const latestYesterdayRecord = yesterdayDifferenceRecords
            .filter(rec => rec.userName === userName && rec.stackName === stackName)
            .sort((a, b) => moment(b.timestamp).diff(moment(a.timestamp)))[0];

        if (latestYesterdayRecord) {
            initialEnergy = latestYesterdayRecord.lastEnergy != null ? latestYesterdayRecord.lastEnergy : 0;
initialCumulatingFlow = latestYesterdayRecord.lastCumulatingFlow != null ? latestYesterdayRecord.lastCumulatingFlow : 0;
console.log(`Found previous day record in S3 for ${userName} - ${stackName}. Initial Flow: ${initialCumulatingFlow}`);
        } else {
            // This is a new device, try to get its first reading from today's hourly data
            const firstReadingToday = todaysHourlyData
                .flatMap(e => e.stacks.map(s => ({...s, userName: e.userName})))
                .find(s => s.userName === userName && s.stackName === stackName);
            
            initialEnergy = firstReadingToday?.energy || 0;
            initialCumulatingFlow = firstReadingToday?.cumulatingFlow || 0;
            console.log(`No previous day record in S3 for ${userName} - ${stackName}. Using first reading of the day. Initial Flow: ${initialCumulatingFlow}`);
        }

const record = {
userName,
stackName,
stationType,
          interval: 'daily',
intervalType: 'day',
          date: today,
          time: moment().tz('Asia/Kolkata').format('HH:mm:ss'),
initialEnergy,
          lastEnergy: initialEnergy,
initialCumulatingFlow,
          lastCumulatingFlow: initialCumulatingFlow,
          energyDifference: 0,
          cumulatingFlowDifference: 0,
timestamp: new Date().toISOString()
};
        newInitialRecords.push(record);
}

    // --- Step 4: Prepend new records and upload back to S3 ---
    const finalData = [...newInitialRecords, ...existingDifferenceData];

    await s3.putObject({
        Bucket: bucketName,
        Key: differenceFileKey,
        Body: JSON.stringify(finalData, null, 2),
        ContentType: 'application/json'
    }).promise();

    console.log(`✅ Successfully saved ${newInitialRecords.length} initial records to S3.`);

} catch (error) {
console.error('A critical error occurred in the saveInitialData job:', error);
}
};


//to add data 

// Updated function: pick first non‑zero hourly value as initial if the very first is 0
const calculateDailyDifferenceFromS3 = async () => {
try {
const bucketName = 'ems-ebhoom-bucket';
const hourlyFileKey = 'hourly_data/hourlyData.json';
    const differenceFileKey = 'difference_data/hourlyDifferenceData.json';
    let hourlyData = [];
    let differenceData = [];

// --- Step 1: Fetch S3 files ---
console.log('Fetching hourly data from S3...');
try {
const hourlyS3Object = await s3.getObject({ Bucket: bucketName, Key: hourlyFileKey }).promise();
hourlyData = JSON.parse(hourlyS3Object.Body.toString('utf-8'));
} catch (s3Error) {
if (s3Error.code === 'NoSuchKey') {
console.log('Hourly data file not found. Cannot proceed with final calculation.');
return;
}
throw s3Error;
}

    console.log('Fetching difference data from S3 to update...');
    try {
        const differenceS3Object = await s3.getObject({ Bucket: bucketName, Key: differenceFileKey }).promise();
        differenceData = JSON.parse(differenceS3Object.Body.toString('utf-8'));
    } catch (s3Error) {
        if (s3Error.code === 'NoSuchKey') {
            console.log('Difference data file not found. Cannot update.');
            return;
        }
        throw s3Error;
    }

const today = moment().tz('Asia/Kolkata').format('DD/MM/YYYY');
console.log('Calculating final daily differences for date:', today);

const todaysHourlyData = hourlyData.filter(entry => entry.date === today);
if (todaysHourlyData.length === 0) {
console.log('No hourly data for today. No calculations to perform.');
return;
}

// --- Step 2: Group today's hourly data by stack ---
const grouped = {};
todaysHourlyData.forEach(entry => {
entry.stacks.forEach(stack => {
const key = `${entry.userName}_${stack.stackName}`;
if (!grouped[key]) {
grouped[key] = { userName: entry.userName, stackName: stack.stackName, entries: [] };
}
grouped[key].entries.push({ ...stack, timestamp: entry.timestamp });
});
});

    // --- Step 3: Update the differenceData in memory ---
    let updatedCount = 0;
for (const key in grouped) {
const { userName, stackName, entries } = grouped[key];

      // Find the corresponding record created by the morning job in our S3 data
      const recordToUpdate = differenceData.find(rec => 
          rec.userName === userName &&
          rec.stackName === stackName &&
          rec.date === today
      );

if (!recordToUpdate) {
console.warn(`⚠️ Could not find initial record in S3 file for ${userName} - ${stackName}.`);
continue;
}

const { initialEnergy, initialCumulatingFlow } = recordToUpdate;

entries.sort((a, b) => moment(a.timestamp).diff(moment(b.timestamp)));

const lastWithEnergy = [...entries].reverse().find(e => e.energy > 0);
let finalEnergy = lastWithEnergy ? lastWithEnergy.energy : entries[entries.length - 1].energy || 0;

const lastWithFlow = [...entries].reverse().find(e => e.cumulatingFlow > 0);
let finalCumFlow = lastWithFlow ? lastWithFlow.cumulatingFlow : entries[entries.length - 1].cumulatingFlow || 0;

      // Update the record directly
      recordToUpdate.lastEnergy = finalEnergy;
      recordToUpdate.energyDifference = finalEnergy - initialEnergy;
      recordToUpdate.lastCumulatingFlow = finalCumFlow;
      recordToUpdate.cumulatingFlowDifference = finalCumFlow - initialCumulatingFlow;
      recordToUpdate.time = moment().tz('Asia/Kolkata').format('HH:mm:ss');
      recordToUpdate.timestamp = new Date().toISOString();
      
      updatedCount++;
console.log(`✅ Calculated final difference for ${userName} - ${stackName}`);
}

    // --- Step 4: Write the modified data back to S3 ---
    if (updatedCount > 0) {
        await s3.putObject({
            Bucket: bucketName,
            Key: differenceFileKey,
            Body: JSON.stringify(differenceData, null, 2),
            ContentType: 'application/json'
        }).promise();
        console.log(`📦 Successfully updated ${updatedCount} records in S3.`);
    } else {
        console.log('No records were updated.');
    }

} catch (error) {
console.error('❌ Error in calculateDailyDifferenceFromS3 job:', error);
}
};

// Schedule the two cron jobs
const scheduleDifferenceCalculation = () => { 
    cron.schedule('5 0 * * *', async () => {
        console.log('Running initial data capture cron job at 00:05 IST...');
        await saveInitialData();
    }, {
    timezone: "Asia/Kolkata"
    });
    console.log('Initial data capture scheduled to run at 00:05 IST daily.');
    
    cron.schedule('55 23 * * *', async () => {
        console.log('Running daily difference calculation cron job at 23:55 IST...');
        await calculateDailyDifferenceFromS3();
    }, {
    timezone: "Asia/Kolkata"
    });
    console.log('Daily difference calculation scheduled to run at 23:55 IST daily.');
};

// Kick off scheduling
scheduleDifferenceCalculation();

// Schedule the two cron jobs



const addManualDifferenceData = async (req, res) => {
  try {
    const { differenceData } = req.body;

    if (!differenceData || !Array.isArray(differenceData)) {
      return res.status(400).json({
        success: false,
        message: 'differenceData array is required in the request body'
      });
    }

    // Add timestamp if not provided
    const processedData = differenceData.map(item => ({
      ...item,
      timestamp: item.timestamp || new Date().toISOString()
    }));

    const bucketName = 'ems-ebhoom-bucket';
    const fileKey = 'difference_data/hourlyDifferenceData.json';
    
    // Get existing data
    let existingData = [];
    try {
      const s3Object = await s3.getObject({ Bucket: bucketName, Key: fileKey }).promise();
      existingData = JSON.parse(s3Object.Body.toString('utf-8'));
    } catch (error) {
      if (error.code !== 'NoSuchKey') {
        console.error('Error fetching existing data:', error);
        throw error;
      }
    }

    // Merge data (new data first)
    const mergedData = [...processedData, ...existingData];

    // Upload back to S3
    await s3.putObject({
      Bucket: bucketName,
      Key: fileKey,
      Body: JSON.stringify(mergedData),
      ContentType: 'application/json'
    }).promise();

    return res.status(200).json({
      success: true,
      message: `Successfully added ${processedData.length} records`,
      addedRecords: processedData.length,
      totalRecords: mergedData.length
    });

  } catch (error) {
    console.error('Error in manual data upload:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};
// Controller to fetch difference data by userName and interval
// Controller to fetch difference data by userName and interval with pagination
const getDifferenceDataByUserNameAndInterval = async (userName, interval, page = 1, limit = 50) => {
    try {
        const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format

        // Fetch all data from MongoDB
        let dbData = await DifferenceData.find({ userName, interval })
            .select('userName interval stackName date time initialEnergy lastEnergy energyDifference initialCumulatingFlow lastCumulatingFlow cumulatingFlowDifference initialFlowRate lastFlowRate flowRateDifference timestamp')
            .lean();

        // Fetch data from S3
        const bucketName = 'ems-ebhoom-bucket';
        const s3Key = 'difference_data/hourlyDifferenceData.json';

        let s3Data = [];
        try {
            const s3Object = await s3.getObject({ Bucket: bucketName, Key: s3Key }).promise();
            const fileData = JSON.parse(s3Object.Body.toString('utf-8'));

            // Filter S3 data based on userName and interval
            s3Data = fileData.filter(entry => entry.userName === userName && entry.interval === interval);
        } catch (err) {
            if (err.code !== 'NoSuchKey') throw err; // Ignore missing file errors
        }

        // Combine MongoDB and S3 data
        let combinedData = [...dbData, ...s3Data];

        // **Ensure Today's Data is Moved to the Top**
        let todayData = combinedData.filter(entry => entry.date === today);
        let pastData = combinedData.filter(entry => entry.date !== today);

        // **Sort past data in descending order (latest first)**
        pastData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // **Final Sorted Data**
        let sortedData = [...todayData, ...pastData];

        // **Apply Pagination AFTER Sorting**
        const total = sortedData.length;
        const paginatedData = sortedData.slice((page - 1) * limit, page * limit);

        return {
            data: paginatedData,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    } catch (error) {
        console.error('Error fetching data by userName and interval:', error);
        throw error;
    }
};



// Controller to fetch data by userName and time range with projections and limit
// Controller to fetch data by userName and time range with pagination
const getDifferenceDataByTimeRange = async (userName, interval, fromDate, toDate, page = 1, limit = 10) => {
    try {
        if (!['daily', 'hourly'].includes(interval)) {
            throw new Error('Invalid interval. Use "daily" or "hourly".');
        }

        const startIST = moment.tz(fromDate, 'DD-MM-YYYY', 'Asia/Kolkata').startOf('day');
        const endIST = moment.tz(toDate, 'DD-MM-YYYY', 'Asia/Kolkata').endOf('day');

        const startUTC = startIST.utc().toDate();
        const endUTC = endIST.utc().toDate();

        if (isNaN(startUTC) || isNaN(endUTC)) {
            throw new Error('Invalid date format. Use "DD-MM-YYYY".');
        }

        const skip = (page - 1) * limit;

        // Fetch data from MongoDB
        const dbData = await DifferenceData.find({
            userName,
            interval,
            timestamp: { $gte: startUTC, $lte: endUTC },
        })
            .select('userName interval stackName date time initialEnergy lastEnergy energyDifference timestamp')
            .sort({ timestamp: -1 })
            .lean();

        // Fetch data from S3
        const bucketName = 'ems-ebhoom-bucket'; // Replace with your bucket name
        const s3Key = 'difference_data/hourlyDifferenceData.json'; // Path to S3 file

        let s3Data = [];
        try {
            const s3Object = await s3.getObject({ Bucket: bucketName, Key: s3Key }).promise();
            const fileData = JSON.parse(s3Object.Body.toString('utf-8'));

            // Filter data based on userName, interval, and timestamp range
            s3Data = fileData.filter(entry => {
                const entryDate = moment(entry.date, 'DD/MM/YYYY').utc().toDate();
                return entry.userName === userName && entry.interval === interval &&
                    entryDate >= startUTC && entryDate <= endUTC;
            });
        } catch (err) {
            if (err.code !== 'NoSuchKey') throw err; // If the file doesn't exist, ignore; otherwise, rethrow
        }

        // Combine MongoDB and S3 data
        const combinedData = [...dbData, ...s3Data];
        const total = combinedData.length;

        // Paginate combined data
        const paginatedData = combinedData.slice(skip, skip + limit);

        return {
            data: paginatedData,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    } catch (error) {
        console.error('Error fetching data by time range:', error);
        throw error;
    }
};

// get the data using the userName interval fromDate toDate last data of every day mentioned
const getLastDataByDateRange = async (userName, interval, fromDate, toDate) => {
    try {
        if (!['daily', 'hourly'].includes(interval)) {
            throw new Error('Invalid interval. Use "daily" or "hourly".');
        }

        const startIST = moment.tz(fromDate, 'DD-MM-YYYY', 'Asia/Kolkata').startOf('day');
        const endIST = moment.tz(toDate, 'DD-MM-YYYY', 'Asia/Kolkata').endOf('day');

        const startUTC = startIST.utc().toDate();
        const endUTC = endIST.utc().toDate();

        if (isNaN(startUTC) || isNaN(endUTC)) {
            throw new Error('Invalid date format. Use "DD-MM-YYYY".');
        }

        // Fetch distinct dates within the range from MongoDB
        const dbData = await DifferenceData.aggregate([
            {
                $match: {
                    userName,
                    interval,
                    timestamp: { $gte: startUTC, $lte: endUTC },
                },
            },
            {
                $addFields: {
                    dateOnly: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
                },
            },
            {
                $group: {
                    _id: '$dateOnly',
                    lastEntry: { $last: '$$ROOT' },
                },
            },
            {
                $sort: { _id: 1 },
            },
        ]);

        // Fetch data from S3 bucket
        const bucketName = 'ems-ebhoom-bucket'; // Replace with your bucket name
        const fileKey = 'difference_data/hourlyDifferenceData.json'; // Path to the S3 file
        let s3Data = [];

        try {
            console.log('Fetching data from S3...');
            const s3Object = await s3.getObject({
                Bucket: bucketName,
                Key: fileKey,
            }).promise();
            const s3FileData = JSON.parse(s3Object.Body.toString('utf-8'));

            s3Data = s3FileData.filter(entry => {
                const entryDate = moment(entry.date, 'DD/MM/YYYY').utc().toDate();
                return entry.userName === userName && entryDate >= startUTC && entryDate <= endUTC;
            });
        } catch (s3Error) {
            if (s3Error.code === 'NoSuchKey') {
                console.warn('No data file found in S3 bucket.');
            } else {
                console.error('Error fetching data from S3:', s3Error.message);
            }
        }

        // Process S3 data to get the last entry for each day
        const s3GroupedData = s3Data.reduce((acc, entry) => {
            const dateOnly = moment(entry.timestamp).format('YYYY-MM-DD');
            if (!acc[dateOnly] || moment(entry.timestamp).isAfter(acc[dateOnly].timestamp)) {
                acc[dateOnly] = entry;
            }
            return acc;
        }, {});

        const s3LastEntries = Object.values(s3GroupedData);

        // Combine MongoDB and S3 data
        const combinedData = [...dbData.map(entry => entry.lastEntry), ...s3LastEntries];

        if (combinedData.length === 0) {
            throw new Error('No data found for the specified criteria.');
        }

        return {
            success: true,
            message: `Last data for each date fetched successfully.`,
            data: combinedData,
        };
    } catch (error) {
        console.error('Error fetching last data by date range:', error);
        throw error;
    }
};

const getTodayDifferenceData = async (req, res) => {
    try {
        const { userName } = req.query;

        if (!userName) {
            return res.status(400).json({ success: false, message: 'userName is required.' });
        }

        // Get today's date in IST and convert to UTC range
        const todayStartIST = moment().tz('Asia/Kolkata').startOf('day');
        const todayEndIST = moment().tz('Asia/Kolkata').endOf('day');

        const todayStartUTC = todayStartIST.utc().toDate();
        const todayEndUTC = todayEndIST.utc().toDate();

        // Fetch today's data from the database
        const dbData = await DifferenceData.find({
            userName,
            timestamp: { $gte: todayStartUTC, $lte: todayEndUTC },
        })
            .select('userName interval stackName date time initialEnergy lastEnergy energyDifference initialCumulatingFlow lastCumulatingFlow cumulatingFlowDifference timestamp')
            .sort({ timestamp: -1 })
            .lean();

        // Fetch data from S3 bucket
        const bucketName = 'ems-ebhoom-bucket'; // Replace with your bucket name
        const fileKey = 'difference_data/hourlyDifferenceData.json'; // Replace with your S3 key
        const params = {
            Bucket: bucketName,
            Key: fileKey,
        };

        let s3Data = [];
        try {
            console.log('Fetching hourly data from S3...');
            const s3Object = await s3.getObject(params).promise();
            const s3FileData = JSON.parse(s3Object.Body.toString('utf-8'));

            // Filter S3 data for today and the given userName
            s3Data = s3FileData.filter(entry => {
                const entryDate = moment(entry.date, 'DD/MM/YYYY').utc().toDate();
                return entry.userName === userName && entryDate >= todayStartUTC && entryDate <= todayEndUTC;
            });
        } catch (s3Error) {
            if (s3Error.code === 'NoSuchKey') {
                console.warn('No data file found in S3 bucket for the given key.');
            } else {
                console.error('Error fetching data from S3:', s3Error.message);
            }
        }

        // Combine database and S3 data
        const combinedData = [...dbData, ...s3Data];

        if (combinedData.length === 0) {
            return res.status(404).json({
                success: false,
                message: `No difference data found for ${userName} today.`,
            });
        }

        res.status(200).json({
            success: true,
            message: `Today's combined difference data for ${userName} fetched successfully.`,
            data: combinedData,
        });
    } catch (error) {
        console.error('Error fetching today\'s combined difference data:', error);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error',
            error: error.message,
        });
    }
};



// Controller to fetch both hourly and daily difference data by userName
// Controller to fetch all difference data by userName with pagination and interval filtering
const getAllDifferenceDataByUserName = async (userName, interval, page = 1, limit = 10) => {
    try {
        if (!['daily', 'hourly'].includes(interval)) {
            throw new Error('Invalid interval. Use "daily" or "hourly".');
        }

        const skip = (page - 1) * limit;

        const data = await DifferenceData.find({ userName, interval })
            .select('userName interval stackName date time initialEnergy lastEnergy energyDifference timestamp')
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await DifferenceData.countDocuments({ userName, interval });

        return {
            data,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    } catch (error) {
        console.error('Error fetching all difference data:', error);
        throw error;
    }
};


//get yesterdays difference data 

const getYesterdayDifferenceData = async (userName) => {
    try {
        // 🔹 Get Yesterday's Date in IST
        const yesterdayIST = moment().tz("Asia/Kolkata").subtract(1, "day");
        const formattedYesterdayDate = yesterdayIST.format("DD/MM/YYYY");

        // 🔹 Convert to UTC for MongoDB Query
        const yesterdayStartUTC = yesterdayIST.startOf("day").utc().toDate();
        const yesterdayEndUTC = yesterdayIST.endOf("day").utc().toDate();

        console.log(`Fetching data for user: ${userName}`);
        console.log(`Yesterday UTC Start: ${yesterdayStartUTC}, End: ${yesterdayEndUTC}`);
        console.log(`Formatted Yesterday Date (DD/MM/YYYY): ${formattedYesterdayDate}`);

        // ✅ **Step 1: Fetch Data from MongoDB**
        const dbData = await DifferenceData.find({
            userName,
            $or: [
                { timestamp: { $gte: yesterdayStartUTC, $lte: yesterdayEndUTC } },
                { date: formattedYesterdayDate },
            ],
        })
        .select("userName stackName date time timestamp initialEnergy lastEnergy energyDifference initialCumulatingFlow lastCumulatingFlow cumulatingFlowDifference")
        .sort({ timestamp: -1 }) // Sorting by timestamp to get the latest first
        .lean();

        const filteredDbData = dbData.filter(entry => entry.date === formattedYesterdayDate);
        console.log(`Filtered Database Data Found: ${filteredDbData.length}`);

        if (filteredDbData.length === 0) {
            console.warn(`⚠ No database records found for ${userName} on ${formattedYesterdayDate}`);
        }

        // ✅ **Step 2: Fetch Data from S3**
        const bucketName = "ems-ebhoom-bucket";
        const fileKey = "difference_data/hourlyDifferenceData.json";
        let s3Data = [];

        try {
            console.log("Fetching hourly data from S3...");
            const s3Object = await s3.getObject({ Bucket: bucketName, Key: fileKey }).promise();
            const s3FileData = JSON.parse(s3Object.Body.toString("utf-8"));

            console.log(`Total records in S3 file: ${s3FileData.length}`);

            // 🔹 Filter S3 Data for Yesterday
            s3Data = s3FileData.filter(entry => entry.userName === userName && entry.date === formattedYesterdayDate);

            console.log(`Filtered S3 Data Found: ${s3Data.length}`);
        } catch (s3Error) {
            if (s3Error.code === "NoSuchKey") {
                console.warn("⚠ No data file found in S3 bucket for the given key.");
            } else {
                console.error("Error fetching data from S3:", s3Error.message);
            }
        }

        // ✅ **Step 3: Combine Data**
        const combinedData = [...filteredDbData, ...s3Data];

        if (combinedData.length === 0) {
            console.warn(`⚠ No data found for ${userName} on ${formattedYesterdayDate}`);
            return []; // ✅ **Return empty array instead of throwing an error**
        }

        // ✅ **Step 4: Get Only the Last Entered Value for Each stackName**
        const latestEntries = {};
        combinedData.forEach(entry => {
            if (
                !latestEntries[entry.stackName] || 
                new Date(entry.timestamp) > new Date(latestEntries[entry.stackName].timestamp)
            ) {
                latestEntries[entry.stackName] = entry;
            }
        });

        const latestData = Object.values(latestEntries);

        console.log(`Final Filtered Data (Only Last Entered for Each StackName): ${latestData.length}`);
        return latestData;
    } catch (error) {
        console.error("Error fetching yesterday's difference data:", error);
        throw error;
    }
};



// Function to download data as CSV

// Unified function to download difference data as CSV or PDF
const downloadDifferenceData = async (req, res) => {
    try {
        const { userName, fromDate, toDate, format, intervalType = 'daily' } = req.query;

        console.log('Query Parameters:', req.query);

        if (!userName || !fromDate || !toDate || !format) {
            return res.status(400).json({ success: false, message: 'Missing required query parameters.' });
        }

        const parsedFromDate = moment.tz(fromDate, 'DD-MM-YYYY', 'Asia/Kolkata').startOf('day').toDate();
        const parsedToDate = moment.tz(toDate, 'DD-MM-YYYY', 'Asia/Kolkata').endOf('day').toDate();

        if (isNaN(parsedFromDate) || isNaN(parsedToDate)) {
            return res.status(400).json({ success: false, message: 'Invalid date format. Use "DD-MM-YYYY".' });
        }

        // Query the data using userName, interval type, and timestamp range
        const data = await DifferenceData.find({
            userName: decodeURIComponent(userName.trim()),
            interval: intervalType,
            timestamp: { $gte: parsedFromDate, $lte: parsedToDate },
        }).lean();

        if (!data.length) {
            return res.status(404).json({ success: false, message: 'No data found for the specified criteria.' });
        }

        if (format === 'csv') {
            const fields = [
                'userName', 'interval', 'date', 'time', 'stackName',
                'initialEnergy', 'lastEnergy', 'energyDifference',
                'initialInflow', 'lastInflow', 'inflowDifference',
                'initialFinalFlow', 'lastFinalFlow', 'finalFlowDifference',
            ];

            const csvParser = new Parser({ fields });
            const csv = csvParser.parse(data);

            res.header('Content-Type', 'text/csv');
            res.attachment(`${userName}_difference_data.csv`);
            return res.send(csv);
        } else if (format === 'pdf') {
            const doc = new PDFDocument();
            res.header('Content-Type', 'application/pdf');
            res.attachment(`${userName}_difference_data.pdf`);

            doc.pipe(res);
            doc.fontSize(20).text('Difference Data Report', { align: 'center' });
            doc.fontSize(12).text(`User Name: ${userName}`);
            doc.fontSize(12).text(`Date Range: ${fromDate} - ${toDate}`);
            doc.fontSize(12).text(`Interval Type: ${intervalType}`);
            doc.moveDown();

            data.forEach(item => {
                doc.fontSize(10).text(`Date: ${item.date}, Time: ${item.time}, Stack: ${item.stackName}`);
                doc.text(`Initial Energy: ${item.initialEnergy}, Last Energy: ${item.lastEnergy}, Energy Difference: ${item.energyDifference}`);
                doc.text(`Initial Inflow: ${item.initialInflow}, Last Inflow: ${item.lastInflow}, Inflow Difference: ${item.inflowDifference}`);
                doc.text(`Initial Final Flow: ${item.initialFinalFlow}, Last Final Flow: ${item.lastFinalFlow}, Final Flow Difference: ${item.finalFlowDifference}`);
                doc.moveDown();
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

const getEnergyAndFlowDataByDateRange = async (userName, fromDate, toDate) => {
    try {
        const startIST = moment.tz(fromDate, 'DD-MM-YYYY', 'Asia/Kolkata').startOf('day');
        const endIST = moment.tz(toDate, 'DD-MM-YYYY', 'Asia/Kolkata').endOf('day');

        const startUTC = startIST.utc().toDate();
        const endUTC = endIST.utc().toDate();

        if (isNaN(startUTC) || isNaN(endUTC)) {
            throw new Error('Invalid date format. Use "DD-MM-YYYY".');
        }

        // Fetch data from MongoDB
        const dbData = await DifferenceData.find({
            userName,
            timestamp: { $gte: startUTC, $lte: endUTC },
        })
            .select('userName stackName date time initialEnergy lastEnergy initialCumulatingFlow lastCumulatingFlow timestamp')
            .sort({ timestamp: -1 })
            .lean();

        // Fetch data from S3 bucket
        const bucketName = 'ems-ebhoom-bucket'; // Replace with your bucket name
        const fileKey = 'difference_data/hourlyDifferenceData.json'; // Replace with your S3 key
        const params = {
            Bucket: bucketName,
            Key: fileKey,
        };

        let s3Data = [];
        try {
            console.log('Fetching hourly data from S3...');
            const s3Object = await s3.getObject(params).promise();
            const s3FileData = JSON.parse(s3Object.Body.toString('utf-8'));

            // Filter S3 data for the given userName and date range
            s3Data = s3FileData.filter(entry => {
                const entryDate = moment(entry.date, 'DD/MM/YYYY').utc().toDate();
                return entry.userName === userName && entryDate >= startUTC && entryDate <= endUTC;
            });
        } catch (s3Error) {
            if (s3Error.code === 'NoSuchKey') {
                console.warn('No data file found in S3 bucket for the given key.');
            } else {
                console.error('Error fetching data from S3:', s3Error.message);
            }
        }

        // Combine database and S3 data
        const combinedData = [...dbData, ...s3Data];

        if (combinedData.length === 0) {
            throw new Error('No data found for the specified criteria.');
        }

        return {
            success: true,
            message: `Energy and flow data for ${userName} fetched successfully.`,
            data: combinedData,
        };
    } catch (error) {
        console.error('Error fetching energy and flow data by date range:', error);
        throw error;
    }
};


const getLastCumulativeFlowOfMonth = async (req, res) => {
    try {
      const { userName, stackName, month } = req.params;
  
      if (!userName || !stackName) {
        return res.status(400).json({
          success: false,
          message: "userName and stackName are required.",
        });
      }
  
      let selectedMonth, selectedYear;
      if (month) {
        selectedMonth = parseInt(month, 10);
        if (isNaN(selectedMonth) || selectedMonth < 1 || selectedMonth > 12) {
          return res.status(400).json({
            success: false,
            message: "Invalid month provided. Please provide a month between 1 and 12.",
          });
        }
        // For circular chart, use current year
        selectedYear = moment().tz("Asia/Kolkata").year();
      } else {
        // Default to last month if month is not provided
        const today = moment().tz("Asia/Kolkata");
        const lastMonth = today.subtract(1, "month");
        selectedYear = lastMonth.year();
        selectedMonth = lastMonth.month() + 1;
      }
  
      // Try MongoDB first
      const lastEntries = await DifferenceData.find({
        userName,
        stackName,
        date: new RegExp(`/${selectedMonth}/${selectedYear}$`),
      })
        .sort({ timestamp: -1 })
        .select("userName stackName lastCumulatingFlow date timestamp")
        .lean();
  
      if (lastEntries.length > 0) {
        return res.status(200).json({
          success: true,
          message: `Last cumulative flow for ${stackName} of ${userName} in ${selectedMonth}/${selectedYear} fetched successfully from MongoDB.`,
          data: lastEntries,
        });
      }
  
      // If not in MongoDB, try S3
      console.log(`Fetching data from S3 for ${userName}, ${stackName} for ${selectedMonth}/${selectedYear}...`);
      const bucketName = "ems-ebhoom-bucket"; 
      const fileKey = "difference_data/hourlyDifferenceData.json";
      const params = { Bucket: bucketName, Key: fileKey };
  
      let s3Data = [];
      try {
        const s3Object = await s3.getObject(params).promise();
        const s3FileData = JSON.parse(s3Object.Body.toString("utf-8"));
  
        s3Data = s3FileData.filter(entry => {
          const entryDate = moment(entry.date, "DD/MM/YYYY").tz("Asia/Kolkata");
          return (
            entry.userName === userName &&
            entry.stackName === stackName &&
            entryDate.month() + 1 === selectedMonth &&
            entryDate.year() === selectedYear
          );
        });
  
        if (s3Data.length === 0) {
          return res.status(404).json({
            success: false,
            message: `No data found for ${stackName} of ${userName} in S3 for ${selectedMonth}/${selectedYear}.`,
          });
        }
  
        const latestEntry = s3Data.reduce((latest, entry) =>
          moment(entry.timestamp).isAfter(moment(latest.timestamp)) ? entry : latest
        , s3Data[0]);
  
        return res.status(200).json({
          success: true,
          message: `Last cumulative flow for ${stackName} of ${userName} in ${selectedMonth}/${selectedYear} fetched successfully from S3.`,
          data: latestEntry,
        });
      } catch (s3Error) {
        if (s3Error.code === "NoSuchKey") {
          console.warn("⚠ No data file found in S3.");
        } else {
          console.error("❌ Error fetching data from S3:", s3Error.message);
        }
        return res.status(500).json({
          success: false,
          message: "Error fetching data from S3.",
          error: s3Error.message,
        });
      }
    } catch (error) {
      console.error("❌ Error fetching cumulative flow for selected month:", error);
      return res.status(500).json({
        success: false,
        message: "Internal Server Error",
        error: error.message,
      });
    }
  };
  
  /**
   * Controller for the bar chart (user-level, all stacks).
   * Expects: userName and month (number as string) as route parameters.
   * An optional query parameter 'year' can be provided.
   */
  const getLastCumulativeFlowForUser = async (req, res) => {
    try {
      const { userName, month } = req.params;
      const { year } = req.query;
  
      if (!userName || !month) {
        return res.status(400).json({
          success: false,
          message: "userName and month are required.",
        });
      }
  
      const selectedMonth = parseInt(month, 10);
      if (isNaN(selectedMonth) || selectedMonth < 1 || selectedMonth > 12) {
        return res.status(400).json({
          success: false,
          message: "Invalid month provided. Please provide a month between 1 and 12.",
        });
      }
      const selectedYear = year ? parseInt(year, 10) : moment().tz("Asia/Kolkata").year();
  
      // Try MongoDB first
      const lastEntries = await DifferenceData.find({
        userName,
        date: new RegExp(`/${selectedMonth}/${selectedYear}$`),
      })
        .sort({ timestamp: -1 })
        .select("userName stackName lastCumulatingFlow date timestamp stationType")
        .lean();
  
      if (lastEntries.length > 0) {
        // Group by stackName and select the latest entry for each stack
        const latestEntries = {};
        lastEntries.forEach(entry => {
          if (!latestEntries[entry.stackName] || moment(entry.timestamp).isAfter(moment(latestEntries[entry.stackName].timestamp))) {
            latestEntries[entry.stackName] = entry;
          }
        });
        return res.status(200).json({
          success: true,
          message: `Last cumulative flow for ${userName} in ${selectedMonth}/${selectedYear} fetched successfully from MongoDB.`,
          data: Object.values(latestEntries),
        });
      }
  
      // If not in MongoDB, try S3
      console.log(`Fetching data from S3 for ${userName} for ${selectedMonth}/${selectedYear}...`);
      const bucketName = "ems-ebhoom-bucket";
      const fileKey = "difference_data/hourlyDifferenceData.json";
      const params = { Bucket: bucketName, Key: fileKey };
  
      let s3Data = [];
      try {
        const s3Object = await s3.getObject(params).promise();
        const s3FileData = JSON.parse(s3Object.Body.toString("utf-8"));
  
        s3Data = s3FileData.filter(entry => {
          const entryDate = moment(entry.date, "DD/MM/YYYY").tz("Asia/Kolkata");
          return (
            entry.userName === userName &&
            entryDate.month() + 1 === selectedMonth &&
            entryDate.year() === selectedYear
          );
        });
  
        if (s3Data.length === 0) {
          return res.status(404).json({
            success: false,
            message: `No data found for ${userName} in S3 for ${selectedMonth}/${selectedYear}.`,
          });
        }
  
        const latestEntries = {};
        s3Data.forEach(entry => {
          if (!latestEntries[entry.stackName] || moment(entry.timestamp).isAfter(moment(latestEntries[entry.stackName].timestamp))) {
            latestEntries[entry.stackName] = entry;
          }
        });
  
        return res.status(200).json({
          success: true,
          message: `Last cumulative flow for ${userName} in ${selectedMonth}/${selectedYear} fetched successfully from S3.`,
          data: Object.values(latestEntries),
        });
      } catch (s3Error) {
        if (s3Error.code === "NoSuchKey") {
          console.warn("⚠ No data file found in S3.");
        } else {
          console.error("❌ Error fetching data from S3:", s3Error.message);
        }
        return res.status(500).json({
          success: false,
          message: "Error fetching data from S3.",
          error: s3Error.message,
        });
      }
    } catch (error) {
      console.error("❌ Error fetching cumulative flow for user by month:", error);
      return res.status(500).json({
        success: false,
        message: "Internal Server Error",
        error: error.message,
      });
    }
  };
  
  
const getLastCumulativeFlowByMonth = async (req, res) => {
    try {
      const { userName, month } = req.params;
      const { year } = req.query;
  
      if (!userName || !month) {
        return res.status(400).json({
          success: false,
          message: "userName and month are required.",
        });
      }
  
      // Validate month parameter
      const monthNumber = parseInt(month, 10);
      if (isNaN(monthNumber) || monthNumber < 1 || monthNumber > 12) {
        return res.status(400).json({
          success: false,
          message: "Invalid month. Please provide a number between 1 and 12.",
        });
      }
  
      // Use the provided year or default to the current year in Asia/Kolkata timezone
      const selectedYear = year ? parseInt(year, 10) : moment().tz("Asia/Kolkata").year();
  
      // Fetch entries from MongoDB for the selected month and year
      const entries = await DifferenceData.find({
        userName,
        date: new RegExp(`/${monthNumber}/${selectedYear}$`), // matches any day in the given month/year
      })
        .sort({ timestamp: -1 }) // Get the latest entries first
        .select("userName stackName lastCumulatingFlow date timestamp")
        .lean();
  
      if (entries.length > 0) {
        return res.status(200).json({
          success: true,
          message: `Last cumulative flow for ${userName} for ${monthNumber}/${selectedYear} fetched successfully from MongoDB.`,
          data: entries,
        });
      }
  
      // If no data is found in MongoDB, fetch from S3
      console.log(`Fetching data from S3 for ${userName} for ${monthNumber}/${selectedYear}...`);
      const bucketName = "ems-ebhoom-bucket"; // your S3 bucket name
      const fileKey = "difference_data/hourlyDifferenceData.json"; // your S3 file path
  
      const params = {
        Bucket: bucketName,
        Key: fileKey,
      };
  
      let s3Data = [];
      try {
        const s3Object = await s3.getObject(params).promise();
        const s3FileData = JSON.parse(s3Object.Body.toString("utf-8"));
  
        // Filter data for the given user, month, and year
        s3Data = s3FileData.filter((entry) => {
          const entryDate = moment(entry.date, "DD/MM/YYYY").tz("Asia/Kolkata");
          return (
            entry.userName === userName &&
            entryDate.month() + 1 === monthNumber &&
            entryDate.year() === selectedYear
          );
        });
  
        if (s3Data.length === 0) {
          return res.status(404).json({
            success: false,
            message: `No data found for ${userName} in S3 for ${monthNumber}/${selectedYear}.`,
          });
        }
  
        // Group data by stackName and get the latest entry for each stack
        const latestEntries = {};
        s3Data.forEach((entry) => {
          if (
            !latestEntries[entry.stackName] ||
            moment(entry.timestamp).isAfter(moment(latestEntries[entry.stackName].timestamp))
          ) {
            latestEntries[entry.stackName] = entry;
          }
        });
  
        return res.status(200).json({
          success: true,
          message: `Last cumulative flow for ${userName} for ${monthNumber}/${selectedYear} fetched successfully from S3.`,
          data: Object.values(latestEntries),
        });
      } catch (s3Error) {
        if (s3Error.code === "NoSuchKey") {
          console.warn("⚠ No data file found in S3.");
        } else {
          console.error("❌ Error fetching data from S3:", s3Error.message);
        }
        return res.status(500).json({
          success: false,
          message: "Error fetching data from S3.",
          error: s3Error.message,
        });
      }
    } catch (error) {
      console.error("❌ Error fetching cumulative flow for selected month:", error);
      return res.status(500).json({
        success: false,
        message: "Internal Server Error",
        error: error.message,
      });
    }
  };


/* selected month */
//current month
const getDifferenceDataForCurrentMonth = async (req, res) => {
    try {
      const { userName } = req.query;
      if (!userName) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing required parameter: userName." 
        });
      }
  
      // Get current date/time in Asia/Kolkata timezone
      const currentIST = moment().tz("Asia/Kolkata");
  
      // Calculate start of the current month (first day)
      const startIST = currentIST.clone().startOf("month");
      // End date is now
      const endIST = currentIST;
  
      // Convert IST dates to UTC for querying the database
      const startUTC = startIST.utc().toDate();
      const endUTC = endIST.utc().toDate();
  
      // Query the database using the computed UTC date range
      const data = await DifferenceData.find({
        userName: decodeURIComponent(userName.trim()),
        timestamp: { $gte: startUTC, $lte: endUTC },
      })
        .sort({ timestamp: -1 })
        .lean();
  
      if (!data || data.length === 0) {
        return res.status(404).json({
          success: false,
          message: `No difference data found for ${userName} from ${startIST.format("DD-MM-YYYY")} to ${endIST.format("DD-MM-YYYY")}.`
        });
      }
  
      return res.status(200).json({
        success: true,
        message: `Difference data for ${userName} for the current month fetched successfully.`,
        data,
      });
    } catch (error) {
      console.error("Error fetching difference data for current month:", error);
      return res.status(500).json({
        success: false,
        message: "Internal Server Error",
        error: error.message,
      });
    }
  };
// NEW Controller Function: getFirstDayMonthlyDifferenceData

const getFirstDayMonthlyDifferenceData = async (req, res) => {
  try {
    const { userName, year } = req.query;
    if (!userName) {
      return res.status(400).json({ success: false, message: 'userName is required.' });
    }
    // Use provided year or default to the current year in Asia/Kolkata timezone
    const selectedYear = year ? year.toString() : moment().tz('Asia/Kolkata').year().toString();
    // Create a regex to match dates that start with "01/" and end with the selected year (format: DD/MM/YYYY)
    const dateRegex = new RegExp(`^01/\\d{2}/${selectedYear}$`);

    // Attempt to fetch records from MongoDB first
    let records = await DifferenceData.find({
      userName,
      interval: 'daily',
      date: { $regex: dateRegex }
    }).sort({ timestamp: 1 }).lean();

    // If no records found in MongoDB, fetch from S3 as fallback
    if (!records.length) {
      console.log(`No DB records found. Checking S3 for first day monthly difference data for ${userName} in ${selectedYear}...`);
      const bucketName = 'ems-ebhoom-bucket';
      const fileKey = 'difference_data/hourlyDifferenceData.json';
      let s3Data = [];
      try {
        const s3Object = await s3.getObject({ Bucket: bucketName, Key: fileKey }).promise();
        const fileData = JSON.parse(s3Object.Body.toString('utf-8'));
        // Filter S3 data with matching user, interval, and date format
        s3Data = fileData.filter(entry => 
          entry.userName === userName &&
          entry.interval === 'daily' &&
          dateRegex.test(entry.date)
        );
      } catch (s3Error) {
        console.error('Error fetching data from S3:', s3Error);
      }
      records = s3Data;
    }

    if (!records.length) {
      return res.status(404).json({
        success: false,
        message: `No first day of month difference data found for ${userName} in ${selectedYear}.`
      });
    }

    return res.status(200).json({
      success: true,
      message: `First day of month difference data for ${userName} in ${selectedYear} fetched successfully.`,
      data: records
    });
  } catch (error) {
    console.error('Error fetching first day of month difference data:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

//total 
/**
 * Controller to get the total cumulatingFlowDifference for all stacks of a specific user.
 * This function retrieves data from both MongoDB and an S3 bucket, then merges the results.
 *
 * Example Request: GET /api/total-flow/HH014
 */
/**

 */
const getTotalCumulatingFlowDifferenceByUser = async (req, res) => {
  try {
    const { userName } = req.query;
    if (!userName) {
      return res.status(400).json({ success: false, message: "userName is required." });
    }

    // 1. Fetch data from MongoDB for this user.
    const dbData = await DifferenceData.find({ userName }).lean();

    // 2. Fetch data from S3.
    const bucketName = 'ems-ebhoom-bucket';
    const fileKey = 'difference_data/hourlyDifferenceData.json';
    let s3Data = [];
    try {
      const s3Object = await s3.getObject({ Bucket: bucketName, Key: fileKey }).promise();
      const fileData = JSON.parse(s3Object.Body.toString('utf-8'));
      // Filter S3 data for the given user.
      s3Data = fileData.filter(entry => entry.userName === userName);
    } catch (s3Error) {
      if (s3Error.code === 'NoSuchKey') {
        console.warn(`No S3 data file found for key: ${fileKey}`);
      } else {
        console.error("Error fetching S3 data:", s3Error);
      }
    }

    // 3. Combine both data arrays.
    const allData = [...dbData, ...s3Data];

    // 4. Group by stackName and sum up cumulatingFlowDifference.
    const sumByStack = allData.reduce((acc, record) => {
      const stack = record.stackName;
      // Convert to number in case the field is a string and use 0 as a fallback.
      const diff = Number(record.cumulatingFlowDifference) || 0;
      acc[stack] = (acc[stack] || 0) + diff;
      return acc;
    }, {});

    return res.status(200).json({
      success: true,
      message: "Total cumulating flow differences aggregated by stack.",
      data: sumByStack
    });
  } catch (error) {
    console.error("Error calculating total cumulating flow differences:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};

// Aggregates the cumulatingFlowDifference for a specific stack for a given user.
// It sums up all records (from MongoDB and S3) whose userName and stackName match.
const getTotalCumulatingFlowDifferenceByUserAndStack = async (req, res) => {
  try {
    // Expecting both userName and stackName to be provided.
    const { userName, stackName } = req.params;
    if (!userName || !stackName) {
      return res.status(400).json({ success: false, message: "userName and stackName are required." });
    }

    // 1. Fetch records for the specified user and stack from MongoDB.
    const dbData = await DifferenceData.find({ userName, stackName }).lean();

    // 2. Fetch records from S3.
    const bucketName = 'ems-ebhoom-bucket';
    const fileKey = 'difference_data/hourlyDifferenceData.json';
    let s3Data = [];
    try {
      const s3Object = await s3.getObject({ Bucket: bucketName, Key: fileKey }).promise();
      const fileData = JSON.parse(s3Object.Body.toString('utf-8'));
      // Filter S3 data for both userName and stackName.
      s3Data = fileData.filter(entry => entry.userName === userName && entry.stackName === stackName);
    } catch (s3Error) {
      if (s3Error.code === 'NoSuchKey') {
        console.warn(`No S3 data file found for key: ${fileKey}`);
      } else {
        console.error("Error fetching S3 data:", s3Error);
      }
    }

    // 3. Combine the two sources.
    const allData = [...dbData, ...s3Data];

    // 4. Sum up the cumulatingFlowDifference across all matching records.
    const totalDifference = allData.reduce((total, record) => {
      return total + (Number(record.cumulatingFlowDifference) || 0);
    }, 0);

    return res.status(200).json({
      success: true,
      message: `Total cumulating flow difference for stack "${stackName}" for user "${userName}" fetched successfully.`,
      data: { stackName, totalCumulatingFlowDifference: totalDifference }
    });
  } catch (error) {
    console.error("Error calculating cumulating flow difference for specific stack:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message
    });
  }
};
// Add these to your module exports
const getDifferenceDataLastNDays = async (req, res) => {
  try {
    const { userName } = req.params;
    const days = parseInt(req.query.days, 10) || 90;

    if (!userName) {
      return res.status(400).json({ success: false, message: 'userName is required.' });
    }
    if (isNaN(days) || days < 1) {
      return res.status(400).json({ success: false, message: 'Invalid days parameter.' });
    }

    // Compute IST window [start, end]
    const endIST   = moment().tz('Asia/Kolkata').endOf('day');
    const startIST = endIST.clone().subtract(days - 1, 'days').startOf('day');
    const startUTC = startIST.utc().toDate();
    const endUTC   = endIST.utc().toDate();

    // 1) Fetch from MongoDB, filtering stationType
    const dbData = await DifferenceData.find({
      userName,
      stationType: 'effluent_flow',
      timestamp: { $gte: startUTC, $lte: endUTC }
    })
    .sort({ timestamp: -1 })
    .lean();

    // 2) Fetch from S3, filtering stationType
    let s3Data = [];
    try {
      const s3Obj = await s3.getObject({
        Bucket: 'ems-ebhoom-bucket',
        Key:    'difference_data/hourlyDifferenceData.json'
      }).promise();

      const fileData = JSON.parse(s3Obj.Body.toString('utf-8'));
      s3Data = fileData.filter(entry => {
        const ts = moment(entry.timestamp).toDate();
        return (
          entry.userName === userName &&
          entry.stationType === 'effluent_flow' &&
          ts >= startUTC &&
          ts <= endUTC
        );
      });
    } catch (err) {
      if (err.code !== 'NoSuchKey') console.error('S3 fetch error:', err);
      // if file missing or other S3 error, we just proceed with dbData
    }

    // 3) Merge & sort
    const combined = [...dbData, ...s3Data]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (!combined.length) {
      return res.status(404).json({
        success: false,
        message: `No effluent_flow records found for ${userName} in the last ${days} days.`
      });
    }

    // 4) Return
    res.json({
      success: true,
      userName,
      stationType: 'effluent_flow',
      days,
      count: combined.length,
      data: combined
    });

  } catch (err) {
    console.error('getDifferenceDataLastNDays error:', err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};
const getFirstCumulativeFlowOfMonth = async (req, res) => {
  try {
    const { userName, month } = req.params;
    if (!userName || !month) {
      return res.status(400).json({ success: false, message: 'userName and month are required.' });
    }
    const monthNum = parseInt(month, 10);
    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ success: false, message: 'Invalid month. Use 1–12.' });
    }

    // Load from S3
    const bucketName = 'ems-ebhoom-bucket';
    const key = 'difference_data/hourlyDifferenceData.json';
    const s3Object = await s3.getObject({ Bucket: bucketName, Key: key }).promise();
    const allData = JSON.parse(s3Object.Body.toString('utf-8'));

    // Filter entries for this user & month
    const monthEntries = allData
      .filter(e => 
        e.userName === userName &&
        moment(e.date, 'DD/MM/YYYY').month() + 1 === monthNum
      );

    if (!monthEntries.length) {
      return res.status(404).json({ success: false, message: 'No data for that user/month.' });
    }

    // Sort by timestamp ascending
    monthEntries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Pick first‐seen entry per stackName
    const firstByStack = {};
    for (const entry of monthEntries) {
      if (!firstByStack[entry.stackName]) {
        firstByStack[entry.stackName] = entry;
      }
    }

    // Format output
   const result = Object.values(firstByStack).map(e => ({
  userName:              e.userName,
  stackName:             e.stackName,
  stationType:           e.stationType,
  date:                  e.date,
  timestamp:             e.timestamp,
  initialCumulatingFlow: e.initialCumulatingFlow   // ← use this
}));

    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error('Error in getFirstCumulativeFlowOfMonth:', err);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};
const getLastCumulativeFlowsForUserMonth = async (req, res) => {
  try {
    const { userName, month } = req.params;
    if (!userName || !month) {
      return res
        .status(400)
        .json({ success: false, message: 'userName and month are required.' });
    }
    const monthNum = parseInt(month, 10);
    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid month. Use 1–12.' });
    }

    // Pull the S3 file
    const bucketName = 'ems-ebhoom-bucket';
    const key = 'difference_data/hourlyDifferenceData.json';
    const s3Object = await s3.getObject({ Bucket: bucketName, Key: key }).promise();
    const allData = JSON.parse(s3Object.Body.toString('utf-8'));

    // Filter down to this user & month
    const monthEntries = allData.filter(e =>
      e.userName === userName &&
      moment(e.date, 'DD/MM/YYYY').month() + 1 === monthNum
    );
    if (!monthEntries.length) {
      return res
        .status(404)
        .json({ success: false, message: 'No data for that user/month.' });
    }

    // Sort newest first
    monthEntries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Grab the very first (newest) record per stackName
    const lastByStack = {};
    for (const entry of monthEntries) {
      if (!lastByStack[entry.stackName]) {
        lastByStack[entry.stackName] = entry;
      }
    }

    // Format
    const result = Object.values(lastByStack).map(e => ({
  userName:            e.userName,
  stackName:           e.stackName,
  stationType:         e.stationType,
  date:                e.date,
  timestamp:           e.timestamp,
  lastCumulatingFlow:  (e.lastCumulatingFlow != null)
                         ? e.lastCumulatingFlow
                         : e.initialCumulatingFlow
}));


    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error('Error in getLastCumulativeFlowsForUserMonth:', err);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

const getDifferenceReport = async (req, res) => {
  try {
    const { userName, fromDate, toDate } = req.query;

    // 1) require parameters
    if (!userName || !fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        message: 'userName, fromDate and toDate are required parameters'
      });
    }

    // 2) validate YYYY-MM-DD
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(fromDate) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(toDate)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    // 3) build IST→UTC range
    const startIST = moment.tz(fromDate, 'YYYY-MM-DD', 'Asia/Kolkata').startOf('day');
    const endIST   = moment.tz(toDate,   'YYYY-MM-DD', 'Asia/Kolkata').endOf('day');
    const startUTC = startIST.utc().toDate();
    const endUTC   = endIST.utc().toDate();

    // 4) load your hourly file from S3
    const bucket = 'ems-ebhoom-bucket';
    const key    = 'difference_data/hourlyDifferenceData.json';
    let all;
    try {
      const obj = await s3.getObject({ Bucket: bucket, Key: key }).promise();
      all = JSON.parse(obj.Body.toString('utf-8'));
    } catch (e) {
      console.error('S3 getObject error', e);
      return res.status(500).json({ success: false, message: 'Could not load S3 data' });
    }

    // 5) filter by userName + timestamp range
    const filtered = all.filter(entry => {
      if (entry.userName !== userName) return false;
      const ts = moment.tz(
        `${entry.date} ${entry.time}`,
        'DD/MM/YYYY HH:mm:ss',
        'Asia/Kolkata'
      ).toDate();
      return ts >= startUTC && ts <= endUTC;
    });

    if (!filtered.length) {
      return res.status(404).json({
        success: false,
        message: `No data found for ${userName} between ${fromDate} and ${toDate}`
      });
    }

    // 6) group by (YYYY-MM-DD, stackName)
    const groups = {};
    filtered.forEach(e => {
      const dayKey = moment.tz(e.date, 'DD/MM/YYYY', 'Asia/Kolkata').format('YYYY-MM-DD');
      const groupKey = `${dayKey}|${e.stackName}`;
      groups[groupKey] = groups[groupKey] || [];
      groups[groupKey].push(e);
    });

    // 7) for each group, sort and pick first & last
    const data = Object.values(groups).map(entries => {
      entries.sort((a, b) => {
        const ta = moment.tz(`${a.date} ${a.time}`, 'DD/MM/YYYY HH:mm:ss','Asia/Kolkata');
        const tb = moment.tz(`${b.date} ${b.time}`, 'DD/MM/YYYY HH:mm:ss','Asia/Kolkata');
        return ta.diff(tb);
      });
      const first = entries[0];
      const last  = entries[entries.length - 1];

      return {
        date:                     moment.tz(first.date, 'DD/MM/YYYY','Asia/Kolkata').format('YYYY-MM-DD'),
        stackName:                first.stackName,
        initialCumulatingFlow:    first.initialCumulatingFlow.toFixed(1),
        lastCumulatingFlow:       last.lastCumulatingFlow.toFixed(1),
        cumulatingFlowDifference: (last.lastCumulatingFlow - first.initialCumulatingFlow).toFixed(1),
        initialEnergy:            first.initialEnergy.toFixed(2),
        lastEnergy:               last.lastEnergy.toFixed(2),
        energyDifference:         (last.lastEnergy - first.initialEnergy).toFixed(2),
      };
    });

    return res.status(200).json({
      success: true,
      message: `Difference report for ${userName} from ${fromDate} to ${toDate}`,
      data
    });

  } catch (error) {
    console.error('getDifferenceReport error', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

//get by month and username
const getDifferenceDataByMonth = async (req, res) => {
  try {
    const { userName, month, year } = req.params;
    // Validate month/year…
    const fromDate = `01-${month.padStart(2,'0')}-${year}`;
    // Get last day of month
    const lastDay = moment(fromDate, 'DD-MM-YYYY').endOf('month').format('DD-MM-YYYY');
    // Delegate to your existing time-range function:
    const { data, total, page, totalPages } =
      await getDifferenceDataByTimeRange(userName, 'daily', fromDate, lastDay, 1, 1000);
    return res.json({ success: true, data, total, page, totalPages });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
// Controller to get total cumulatingFlowDifference for a user in a given month/year (from S3)
/**
 * GET /difference/total-by-month
 * Query params: userName, month (1–12), [year]
 *
 * Returns the sum of cumulatingFlowDifference for each stack,
 * deduped so you only count one entry per day/stack.
 */
/**
 * GET /difference/total-by-month
 * Query params: userName (required), month (1–12, required), year (defaults to current IST)
 *
 * Returns one totalCumulatingFlowDifference per stackName for that month.
 */
const getTotalCumulatingFlowDifferenceByUserAndMonth = async (req, res) => {
  try {
    const { userName, month, year } = req.query;
    if (!userName || !month) {
      return res.status(400).json({
        success: false,
        message: 'userName and month are required query parameters'
      });
    }

    // 1) Validate month/year
    const monthNum = parseInt(month, 10);
    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({
        success: false,
        message: 'Invalid month. Please specify a value from 1 to 12.'
      });
    }
    const selectedYear = year
      ? parseInt(year, 10)
      : moment().tz('Asia/Kolkata').year();
    if (isNaN(selectedYear)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid year.'
      });
    }

    // Build a regex to match DD/MM/YYYY for this month/year
    const monthStr = monthNum.toString().padStart(2, '0');
    const dateRegex = new RegExp(`\\/${monthStr}\\/${selectedYear}$`);

    // 2) Load DB entries (automated daily differences)
    const dbEntries = await DifferenceData.find({
      userName,
      interval: 'daily',
      date: dateRegex
    })
    .lean();

    // 3) Load S3 entries (manual overrides)
    const bucketName = 'ems-ebhoom-bucket';
    const key = 'difference_data/hourlyDifferenceData.json';
    let s3Raw = [];
    try {
      const obj = await s3.getObject({ Bucket: bucketName, Key: key }).promise();
      s3Raw = JSON.parse(obj.Body.toString('utf-8'));
    } catch (err) {
      if (err.code !== 'NoSuchKey') throw err;
      // else: no manual data exists yet
    }
    // filter manual overrides for this user+month
    const s3Entries = s3Raw.filter(e =>
      e.userName === userName &&
      e.interval === 'daily' &&
      dateRegex.test(e.date)
    );

    // 4) Merge: use a map keyed by day+stack; manual overrides win
    const byDayStack = {};
    const addToMap = entry => {
      const key = `${entry.date}__${entry.stackName}`;
      byDayStack[key] = entry; // later calls overwrite
    };
    // first: all DB entries
    dbEntries.forEach(addToMap);
    // then: any manual override
    s3Entries.forEach(addToMap);

    const merged = Object.values(byDayStack);

    // 5) Sum per stackName
    const totalsByStack = merged.reduce((acc, e) => {
      const stack = e.stackName;
      const diff = Number(e.cumulatingFlowDifference) || 0;
      acc[stack] = (acc[stack] || 0) + diff;
      return acc;
    }, {});

    // 6) Format response
    const totals = Object.entries(totalsByStack).map(
      ([stackName, total]) => ({ stackName, totalCumulatingFlowDifference: total })
    );

    return res.status(200).json({
      success: true,
      userName,
      month: monthNum,
      year: selectedYear,
      totals
    });

  } catch (error) {
    console.error('Error in getTotalCumulatingFlowDifferenceByUserAndMonth:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: error.message
    });
  }
};

//delete
const deleteManualDifferenceData = async (req, res) => {
  try {
    // Normalize to an array of criteria
    const criteria = Array.isArray(req.body)
      ? req.body
      : [req.body];

    // Validate
    for (const { userName, date } of criteria) {
      if (!userName || !date) {
        return res.status(400).json({
          success: false,
          message: 'Each entry requires userName and date (DD/MM/YYYY).'
        });
      }
    }

    const bucketName = 'ems-ebhoom-bucket';
    const fileKey    = 'difference_data/hourlyDifferenceData.json';

    // 1. Download existing data
    let existing = [];
    try {
      const obj = await s3.getObject({ Bucket: bucketName, Key: fileKey }).promise();
      existing = JSON.parse(obj.Body.toString('utf-8'));
    } catch (err) {
      if (err.code !== 'NoSuchKey') throw err;
    }

    const beforeCount = existing.length;

    // 2. Build a function: shouldKeep(item) => true if item does *not* match any delete criteria
    const shouldKeep = item => {
      return !criteria.some(({ userName, date, stackName }) => {
        if (item.userName !== userName || item.date !== date) return false;
        // matches on userName+date; if stackName given, must match that too
        return !stackName || item.stackName === stackName;
      });
    };

    const filtered = existing.filter(shouldKeep);
    const removed  = beforeCount - filtered.length;

    if (removed === 0) {
      return res.status(404).json({
        success: false,
        message: `No matching records found for the given criteria.`
      });
    }

    // 3. Write updated data back to S3
    await s3.putObject({
      Bucket: bucketName,
      Key: fileKey,
      Body: JSON.stringify(filtered),
      ContentType: 'application/json'
    }).promise();

    return res.status(200).json({
      success: true,
      message: `Deleted ${removed} record(s).`,
      totalRecords: filtered.length
    });
  } catch (error) {
    console.error('Error deleting S3 data:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};
module.exports = {
    getDifferenceDataByUserNameAndInterval,
    getAllDifferenceDataByUserName,
    getDifferenceDataByTimeRange,
    downloadDifferenceData,
    scheduleDifferenceCalculation,
    getLastDataByDateRange,
    getTodayDifferenceData,
    getEnergyAndFlowDataByDateRange,
    getYesterdayDifferenceData ,
    getLastCumulativeFlowOfMonth ,
    getLastCumulativeFlowForUser,
    getLastCumulativeFlowByMonth,
    getDifferenceDataForCurrentMonth,
    getFirstDayMonthlyDifferenceData,
    getTotalCumulatingFlowDifferenceByUser,
    getTotalCumulatingFlowDifferenceByUserAndStack,
    getDifferenceDataLastNDays,
    getFirstCumulativeFlowOfMonth,
    getLastCumulativeFlowsForUserMonth,addManualDifferenceData,getDifferenceReport,
    getDifferenceDataByMonth,getTotalCumulatingFlowDifferenceByUserAndMonth,deleteManualDifferenceData
};