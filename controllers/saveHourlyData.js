const moment = require('moment');
const cron = require('node-cron');
const AWS = require('aws-sdk');

const HourlyData = require('../models/hourlyData'); // Adjust path as necessary
const IotData = require('../models/iotData'); // Assuming the model is named IotData and imported accordingly
const { calculateAndSaveConsumption } = require('./consumption');

const saveHourlyData = async () => {
    const currentTimeIST = moment().tz('Asia/Kolkata');
    const currentHour = currentTimeIST.format('HH'); // Current hour instead of previous
    
    // Fetch data for the current hour up to now
    const startOfHour = currentTimeIST.clone().startOf('hour').utc().toDate();
    const endOfNow = currentTimeIST.utc().toDate(); // Up to current time instead of end of hour

    console.log(`🕒 Initiating hourly data save for CURRENT hour: ${currentHour} (Fetching IoT Data Between: ${startOfHour} - ${endOfNow})`);

    try {
        // Fetch the LATEST (most recent) stack entry per user and stack within the current hour
        const lastEntries = await IotData.aggregate([
            {
                $match: {
                    timestamp: { $gte: startOfHour, $lte: endOfNow }
                }
            },
            { $unwind: "$stackData" },
            {
                $match: {
                    "stackData.stationType": { $in: ["energy", "effluent_flow"] }
                }
            },
            {
                $sort: { timestamp: -1 } // Sort by timestamp descending to get latest first
            },
            {
                $group: {
                    _id: {
                        userName: "$userName",
                        stackName: "$stackData.stackName"
                    },
                    latestEntry: { $first: "$$ROOT" } // Get the most recent entry per user+stack combination
                }
            },
            {
                $replaceRoot: { newRoot: "$latestEntry" }
            }
        ]);

        if (lastEntries.length === 0) {
            console.log(`❌ No valid stack entries found for current hour: ${currentHour}. Skipping data save.`);
            return;
        }

        console.log(`🔍 Found ${lastEntries.length} stack entries to process for current hour.`);

        const userHourlyData = {};

        for (let entry of lastEntries) {
            const userName = entry.userName;
            if (!userHourlyData[userName]) {
                userHourlyData[userName] = {
                    userName: userName,
                    product_id: entry.product_id,
                    hour: currentHour, // Use current hour
                    date: currentTimeIST.format('DD/MM/YYYY'), // Use current IST date
                    month: currentTimeIST.format('MM'),
                    year: currentTimeIST.format('YYYY'),
                    stacks: [],
                    timestamp: new Date()
                };
            }
            
            const stack = entry.stackData;
            userHourlyData[userName].stacks.push({
                stackName: stack.stackName,
                stationType: stack.stationType,
                energy: stack.stationType === 'energy' ? stack.energy || 0 : 0,
                cumulatingFlow: stack.stationType === 'effluent_flow' ? stack.cumulatingFlow || 0 : 0
            });
        }
        
        const newJsonData = Object.values(userHourlyData);

        // ### S3 Direct Save Logic (No MongoDB save) ###
        const fileName = 'hourly_data/hourlyData.json';
        const bucketName = 'ems-ebhoom-bucket';
        
        let existingJsonData = [];
        try {
            console.log(`📥 Fetching existing data from S3: ${bucketName}/${fileName}`);
            const s3Params = { Bucket: bucketName, Key: fileName };
            const existingFile = await s3.getObject(s3Params).promise();
            existingJsonData = JSON.parse(existingFile.Body.toString('utf-8'));
        } catch (error) {
            if (error.code !== 'NoSuchKey') {
                console.error("❌ Error fetching from S3:", error);
                return; // Exit if there's a critical error
            }
            console.log("⚠️ File not found in S3. A new file will be created.");
        }

        // Remove any existing entries for the same user+date+hour combination to avoid duplicates
        const filteredExistingData = existingJsonData.filter(existingEntry => {
            return !(newJsonData.some(newEntry => 
                existingEntry.userName === newEntry.userName && 
                existingEntry.date === newEntry.date && 
                existingEntry.hour === newEntry.hour
            ));
        });

        // Append new data to the filtered existing data
        const updatedJsonData = [...filteredExistingData, ...newJsonData];

        // Upload the updated file back to S3
        const uploadParams = {
            Bucket: bucketName,
            Key: fileName,
            Body: JSON.stringify(updatedJsonData, null, 2),
            ContentType: 'application/json'
        };

        await s3.upload(uploadParams).promise();
        console.log(`✅ Successfully uploaded ${newJsonData.length} hourly records for CURRENT hour ${currentHour} to S3.`);

        // Trigger consumption calculation
        console.log(`⚡ Triggering consumption calculation for current hour: ${currentHour}`);
        await calculateAndSaveConsumption();

    } catch (error) {
        console.error('❌ Error in the hourly data saving process:', error);
    }
};

// Schedule the task to run at 57 minutes past every hour to capture current hour data
const setupCronJob = () => {
  cron.schedule('57 * * * *', async () => {
    const currentTimeIST = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
    console.log(`⏳ Cron job triggered at IST: ${currentTimeIST} - Saving CURRENT hour data`);
    await saveHourlyData();
  }, {
    timezone: 'Asia/Kolkata',
  });
  console.log('🕒 Hourly data job scheduled to save CURRENT hour data directly to S3 at 57 minutes past the hour.');
};

// Configure AWS SDK
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

const s3 = new AWS.S3();

// Rest of your existing functions remain the same...
const getHourlyDataOfCumulatingFlowAndEnergy = async (req, res) => {
    const { userName, date } = req.query;

    // ❌ Validate request parameters
    if (!userName || !date) {
        return res.status(400).json({
            success: false,
            message: '❌ Missing required query parameters (userName, date).'
        });
    }

    try {
        let dateQuery = {};
        if (/^\d{4}$/.test(date)) {
            dateQuery['year'] = date;
        } else if (/^\d{1,2}$/.test(date)) {
            dateQuery['month'] = date.padStart(2, '0');
            dateQuery['year'] = new Date().getFullYear().toString();
        } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
            dateQuery['date'] = date;
        } else {
            return res.status(400).json({
                success: false,
                message: '❌ Date format is invalid. Use YYYY, MM, or DD/MM/YYYY format.'
            });
        }

        // 🔥 Fetch data from MongoDB first
        const results = await HourlyData.find({ userName: userName, ...dateQuery }).lean();

        console.log(`📊 MongoDB Query Results for user: ${userName}, date: ${date}`, results);

        // ✅ If data is found in MongoDB, return it
        if (results.length > 0) {
            return res.status(200).json({
                success: true,
                data: results.map((entry) => ({
                    hour: entry.hour,
                    date: entry.date,
                    userName: entry.userName,
                    stacks: entry.stacks || [] // ✅ Ensures stack data is always returned
                }))
            });
        }

        console.log('⚠️ No data found in MongoDB. Fetching from S3...');

        // 🔥 Fetch data from S3 if MongoDB has no data
        const s3Key = 'hourly_data/hourlyData.json';
        const s3Data = await fetchDataFromS3(s3Key);

        if (!s3Data || s3Data.length === 0) {
            return res.status(404).json({
                success: false,
                message: '❌ No data found in MongoDB or S3 for the given parameters.'
            });
        }

        // ✅ Filter S3 data based on userName and date
        const filteredS3Data = s3Data.filter(
            (entry) => entry.userName === userName && entry.date === date
        );

        console.log(`📂 Filtered S3 Data for user ${userName} on ${date}:`, filteredS3Data);

        if (filteredS3Data.length === 0) {
            return res.status(404).json({
                success: false,
                message: '❌ No matching data found in S3.'
            });
        }

        return res.status(200).json({
            success: true,
            data: filteredS3Data.map((entry) => ({
                hour: entry.hour,
                date: entry.date,
                userName: entry.userName,
                stacks: entry.stacks || [] // ✅ Ensures stack data is included
            }))
        });

    } catch (error) {
        console.error('❌ Error fetching hourly data:', error);
        return res.status(500).json({
            success: false,
            message: '❌ Internal server error while fetching data.',
            error: error.message
        });
    }
};

/**
 * Fetches data from AWS S3 bucket
 */
const fetchDataFromS3 = async (key) => {
    try {
        const params = {
            Bucket: 'ems-ebhoom-bucket',
            Key: key
        };

        const data = await s3.getObject(params).promise();
        console.log(`✅ Fetched data from S3 for key: ${key}`);

        return JSON.parse(data.Body.toString('utf-8'));
    } catch (error) {
        console.error('❌ Error fetching data from S3:', error);
        return null;
    }
};

const getLastEffluentHourlyByUserName = async (req, res) => {
  const { userName } = req.query;
  if (!userName) {
    return res
      .status(400)
      .json({ success: false, message: 'Missing userName query param' });
  }

  try {
    // 1) Pull the full hourly dump from S3
    const s3Data = await fetchDataFromS3('hourly_data/hourlyData.json');
    if (!Array.isArray(s3Data) || s3Data.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'No hourly data in S3.' });
    }

    // 2) Filter down to this user's records
    const userRecords = s3Data.filter(entry => entry.userName === userName);
    if (userRecords.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: `No data for user ${userName}` });
    }

    // 3) Sort descending by date & hour
    userRecords.sort((a, b) => {
      const da = moment(a.date, 'DD/MM/YYYY');
      const db = moment(b.date, 'DD/MM/YYYY');
      if (da.isBefore(db)) return 1;
      if (da.isAfter(db))  return -1;
      // same date → compare hour numerically
      return parseInt(b.hour, 10) - parseInt(a.hour, 10);
    });

    // 4) Take the top (latest) entry
    const latest = userRecords[0];

    // 5) Pull _all_ effluent_flow stacks out of that one entry
    const effluentStacks = (latest.stacks || [])
      .filter(s => s.stationType === 'effluent_flow')
      .map(s => ({
        stackName: s.stackName,
        stationType: s.stationType,
        cumulatingFlow: s.cumulatingFlow
      }));

    return res.json({
      success: true,
      data: {
        userName: latest.userName,
        date:     latest.date,
        hour:     latest.hour,
        stacks:   effluentStacks
      }
    });
  } catch (err) {
    console.error('Error in getLastEffluentHourlyByUserName:', err);
    return res
      .status(500)
      .json({ success: false, message: 'Server error', error: err.message });
  }
};

const getLastEnergyHourlyByUserName = async (req, res) => {
  const { userName } = req.query;
  if (!userName) {
    return res
      .status(400)
      .json({ success: false, message: 'Missing userName query param' });
  }

  try {
    // 1) Pull the full hourly dump from S3
    const s3Data = await fetchDataFromS3('hourly_data/hourlyData.json');
    if (!Array.isArray(s3Data) || !s3Data.length) {
      return res
        .status(404)
        .json({ success: false, message: 'No hourly data in S3.' });
    }

    // 2) Filter down to this user's records
    const userRecords = s3Data
      .filter(entry => entry.userName === userName)
      // 3) Sort descending by date & hour
      .sort((a, b) => {
        const da = moment(a.date, 'DD/MM/YYYY');
        const db = moment(b.date, 'DD/MM/YYYY');
        if (da.isBefore(db)) return 1;
        if (da.isAfter(db))  return -1;
        return parseInt(b.hour, 10) - parseInt(a.hour, 10);
      });

    if (!userRecords.length) {
      return res
        .status(404)
        .json({ success: false, message: `No data for user ${userName}` });
    }

    // 4) Find the first record (i.e. most recent) that has at least one energy stack
    let found = null;
    for (const rec of userRecords) {
      const energyStacks = (rec.stacks || []).filter(s => s.stationType === 'energy');
      if (energyStacks.length) {
        found = { rec, energyStacks };
        break;
      }
    }

    if (!found) {
      return res
        .status(404)
        .json({ success: false, message: `No energy data found for user ${userName}` });
    }

    // 5) Return that record's date/hour plus all energy stacks
    return res.json({
      success: true,
      data: {
        userName: found.rec.userName,
        date:     found.rec.date,
        hour:     found.rec.hour,
        stacks:   found.energyStacks.map(s => ({
          stackName:   s.stackName,
          stationType: s.stationType,
          energy:      s.energy
        }))
      }
    });
  } catch (err) {
    console.error('Error in getLastEnergyHourlyByUserName:', err);
    return res
      .status(500)
      .json({ success: false, message: 'Server error', error: err.message });
  }
};

const getTodaysHourlyData = async (req, res) => {
  try {
    // format today in your stored format
    const todayDate = moment().tz('Asia/Kolkata').format('DD/MM/YYYY');

    const results = await HourlyData.find({ date: todayDate }).lean();

    return res.status(200).json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error("❌ Error fetching today's hourly data:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

const getTodaysHourlyDataByUserFromS3 = async (req, res) => {
  const { userName } = req.query;
  if (!userName) {
    return res.status(400).json({
      success: false,
      message: '❌ Missing required query param: userName'
    });
  }

  try {
    // 1) pull the full dump from S3
    const s3Data = await fetchDataFromS3('hourly_data/hourlyData.json');
    if (!Array.isArray(s3Data)) {
      return res.status(500).json({
        success: false,
        message: '❌ Invalid data format in S3'
      });
    }

    // 2) compute today's date in DD/MM/YYYY
    const today = moment().tz('Asia/Kolkata').format('DD/MM/YYYY');

    // 3) filter by userName + date
    const filtered = s3Data.filter(
      entry => entry.userName === userName && entry.date === today
    );

    return res.status(200).json({
      success: true,
      data: filtered
    });
  } catch (err) {
    console.error('❌ Error fetching todays hourly data from S3:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message
    });
  }
};

const getDailyEffluentAveragesByUser = async (req, res) => {
  const { userName } = req.query;
  const days = parseInt(req.query.days, 10) || 20;

  if (!userName) {
    return res.status(400).json({
      success: false,
      message: 'Missing required query param: userName'
    });
  }

  try {
    // 1) Pull entire hourly dump from S3
    const allHourly = await fetchDataFromS3('hourly_data/hourlyData.json');
    if (!Array.isArray(allHourly)) {
      return res.status(500).json({ success: false, message: 'Invalid S3 data' });
    }

    // 2) Filter to this user only and within last `days` days
    const cutoff = moment().subtract(days - 1, 'days').startOf('day');
    const userEntries = allHourly.filter(entry => {
      return entry.userName === userName &&
             moment(entry.date, 'DD/MM/YYYY').isSameOrAfter(cutoff, 'day');
    });

    // 3) Aggregate: date → stackName → { sum, count }
    const agg = {};
    userEntries.forEach(entry => {
      const d = entry.date; // "DD/MM/YYYY"
      (entry.stacks || [])
        .filter(s => s.stationType === 'effluent_flow')
        .forEach(s => {
          agg[d] = agg[d] || {};
          const st = agg[d][s.stackName] || { sum: 0, count: 0 };
          st.sum += (s.cumulatingFlow || 0);
          st.count += 1;
          agg[d][s.stackName] = st;
        });
    });

    // 4) Build sorted result array
    const result = Object.entries(agg)
      .map(([date, stacksMap]) => ({
        date,
        stacks: Object.entries(stacksMap).map(([stackName, { sum, count }]) => ({
          stackName,
          avgFlow: count ? parseFloat((sum / count).toFixed(2)) : 0
        }))
      }))
      .sort((a, b) => {
        const ma = moment(a.date, 'DD/MM/YYYY'),
              mb = moment(b.date, 'DD/MM/YYYY');
        return ma.isBefore(mb) ? -1 : 1;
      });

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('getDailyEffluentAveragesByUser error:', err);
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

const getDailyEffluentAverages90Days = async (req, res) => {
  const { userName } = req.query;
  if (!userName) {
    return res
      .status(400)
      .json({ success: false, message: 'Missing required query param: userName' });
  }

  try {
    // 1) Pull entire hourly dump from S3
    const allHourly = await fetchDataFromS3('hourly_data/hourlyData.json');
    if (!Array.isArray(allHourly)) {
      return res.status(500).json({ success: false, message: 'Invalid S3 data' });
    }

    // 2) Filter to this user only and within last 90 days
    const cutoff = moment().subtract(89, 'days').startOf('day');  // 90 days including today
    const userEntries = allHourly.filter(entry =>
      entry.userName === userName &&
      moment(entry.date, 'DD/MM/YYYY').isSameOrAfter(cutoff, 'day')
    );

    // 3) Aggregate: date → stackName → { sum, count }
    const agg = {};
    userEntries.forEach(entry => {
      const d = entry.date;
      (entry.stacks || [])
        .filter(s => s.stationType === 'effluent_flow')
        .forEach(s => {
          agg[d] = agg[d] || {};
          const st = agg[d][s.stackName] || { sum: 0, count: 0 };
          st.sum   += (s.cumulatingFlow || 0);
          st.count += 1;
          agg[d][s.stackName] = st;
        });
    });

    // 4) Build sorted result array
    const result = Object.entries(agg)
      .map(([date, stacksMap]) => ({
        date,
        stacks: Object.entries(stacksMap).map(([stackName, { sum, count }]) => ({
          stackName,
          avgFlow: count ? parseFloat((sum / count).toFixed(2)) : 0
        }))
      }))
      .sort((a, b) => {
        const ma = moment(a.date, 'DD/MM/YYYY');
        const mb = moment(b.date, 'DD/MM/YYYY');
        return ma.isBefore(mb) ? -1 : 1;
      });

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('getDailyEffluentAverages90Days error:', err);
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

/**
 * Fetches all hourly records for a specific user on a given date from S3.
 * The date should be in DD/MM/YYYY format.
 */
const getHourlyDataByDateFromS3 = async (req, res) => {
  // 1. Get userName and date from query parameters
  const { userName, date } = req.query;

  // 2. Validate inputs
  if (!userName || !date) {
    return res.status(400).json({
      success: false,
      message: '❌ Missing required query parameters: userName and date (format: DD/MM/YYYY).',
    });
  }

  try {
    // 3. Fetch the full hourly data dump from S3
    const allHourlyData = await fetchDataFromS3('hourly_data/hourlyData.json');

    if (!allHourlyData || !Array.isArray(allHourlyData)) {
      return res.status(404).json({
        success: false,
        message: '❌ Hourly data not found or is in an invalid format in S3.',
      });
    }

    // 4. Filter the data for the matching user and date
    const filteredData = allHourlyData.filter(
      (entry) => entry.userName === userName && entry.date === date
    );

    if (filteredData.length === 0) {
      return res.status(404).json({
        success: false,
        message: `❌ No data found for user '${userName}' on date '${date}'.`,
      });
    }

    // 5. Sort the results by hour for chronological order
    filteredData.sort((a, b) => parseInt(a.hour, 10) - parseInt(b.hour, 10));

    // 6. Return the filtered and sorted data
    return res.status(200).json({
      success: true,
      data: filteredData,
    });
  } catch (error) {
    console.error('❌ Error in getHourlyDataByDateFromS3:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
      error: error.message,
    });
  }
};

module.exports = { 
    setupCronJob, 
    getHourlyDataOfCumulatingFlowAndEnergy,
    getLastEffluentHourlyByUserName,
    getLastEnergyHourlyByUserName,
    getTodaysHourlyData,
    getTodaysHourlyDataByUserFromS3,
    getDailyEffluentAveragesByUser,
    getDailyEffluentAverages90Days,
    getHourlyDataByDateFromS3
};