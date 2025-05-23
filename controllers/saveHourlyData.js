const moment = require('moment');
const cron = require('node-cron');
const AWS = require('aws-sdk');

const HourlyData = require('../models/hourlyData'); // Adjust path as necessary
const IotData = require('../models/iotData'); // Assuming the model is named IotData and imported accordingly
const { calculateAndSaveConsumption } = require('./consumption');

const saveHourlyData = async () => {
    const currentTimeIST = moment().tz('Asia/Kolkata');
    const currentHour = currentTimeIST.format('HH');
    const previousHour = moment(currentTimeIST).subtract(1, 'hour').format('HH');

    // ✅ **Fetch data from 4:00 - 4:59 when time is between 4:00 - 4:59**
    const startOfHour = moment().tz('Asia/Kolkata').startOf('hour').utc().toDate();
    const endOfHour = moment(startOfHour).add(59, 'minutes').utc().toDate(); // ✅ Adjusted to fetch up to 59 minutes

    console.log(`🕒 Initiating hourly data save for hour: ${previousHour} (Fetching IoT Data Between: ${startOfHour} - ${endOfHour})`);

    try {
        // 🔍 Check if data exists in the correct range
        const iotDataCheck = await IotData.findOne({
            timestamp: { $gte: startOfHour, $lte: endOfHour }
        });

        if (!iotDataCheck) {
            console.log(`❌ No IoT data found between ${startOfHour} and ${endOfHour}. Skipping.`);
            return;
        }

        // 🔥 Fetch only the latest stack entry per user and stack within this adjusted range
        const lastEntries = await IotData.aggregate([
            {
                $match: {
                    timestamp: { $gte: startOfHour, $lte: endOfHour }
                }
            },
            { $unwind: "$stackData" }, // 🔥 Extract each stack entry separately
            {
                $match: {
                    "stackData.stationType": { $in: ["energy", "effluent_flow"] } // ✅ Only store valid station types
                }
            },
            {
                $group: {
                    _id: {
                        userName: "$userName",
                        stackName: "$stackData.stackName"
                    },
                    latestEntry: { $first: "$stackData" },
                    timestamp: { $first: "$timestamp" },
                    product_id: { $first: "$product_id" }
                }
            }
        ]);

        console.log(`🔍 Found ${lastEntries.length} stack entries to process.`);

        if (lastEntries.length === 0) {
            console.log(`❌ No valid stack entries found for hour: ${previousHour}. Skipping data save.`);
            return;
        }

        // Group by user
        const userHourlyData = {};

        for (let entry of lastEntries) {
            if (!userHourlyData[entry._id.userName]) {
                userHourlyData[entry._id.userName] = {
                    userName: entry._id.userName,
                    product_id: entry.product_id,
                    hour: previousHour, // ✅ Always save the previous hour's data
                    date: moment(entry.timestamp).tz('Asia/Kolkata').format('DD/MM/YYYY'),
                    month: moment(entry.timestamp).tz('Asia/Kolkata').format('MM'),
                    year: moment(entry.timestamp).tz('Asia/Kolkata').format('YYYY'),
                    stacks: [],
                    timestamp: new Date()
                };
            }

            // ✅ Save only energy and cumulatingFlow
            userHourlyData[entry._id.userName].stacks.push({
                stackName: entry._id.stackName,
                stationType: entry.latestEntry.stationType,
                energy: entry.latestEntry.stationType === 'energy' ? entry.latestEntry.energy || 0 : 0,
                cumulatingFlow: entry.latestEntry.stationType === 'effluent_flow' ? entry.latestEntry.cumulatingFlow || 0 : 0
            });
        }

        for (const user in userHourlyData) {
            console.log(`💾 Saving hourly record for ${user}:`, JSON.stringify(userHourlyData[user], null, 2));

            await HourlyData.findOneAndUpdate(
                { userName: userHourlyData[user].userName, hour: previousHour, date: userHourlyData[user].date },
                userHourlyData[user],
                { upsert: true, new: true }
            );
        }

        console.log(`✅ Hourly data processing completed successfully for hour: ${previousHour}`);

        // ✅ Trigger the consumption calculation
        console.log(`⚡ Triggering consumption calculation for hour: ${previousHour}`);
        await calculateAndSaveConsumption();

    } catch (error) {
        console.error('❌ Error saving hourly data:', error);
    }
};





// Schedule the task to run at the beginning of every hour
const setupCronJob = () => {
  cron.schedule('58 * * * *', async () => {
    const currentTimeIST = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
    console.log(`⏳ Cron job triggered at IST: ${currentTimeIST}`);
    await saveHourlyData();
}, {
    timezone: 'Asia/Kolkata',
});

};

// Configure AWS SDK
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

const s3 = new AWS.S3();

/* const fetchDataFromS3 = async (key) => {
    try {
        const params = {
            Bucket: 'ems-ebhoom-bucket',
            Key: key,
        };

        const data = await s3.getObject(params).promise();
        console.log(`Fetched data from S3 for key: ${key}`, data.Body.toString('utf-8'));

        return JSON.parse(data.Body.toString('utf-8'));
    } catch (error) {
        console.error('Error fetching data from S3:', error);
        throw new Error('Failed to fetch data from S3');
    }
}; */

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

    // 2) Filter down to this user’s records
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

    // 2) Filter down to this user’s records
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

    // 5) Return that record’s date/hour plus all energy stacks
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


module.exports = { setupCronJob, getHourlyDataOfCumulatingFlowAndEnergy ,getLastEffluentHourlyByUserName,getLastEnergyHourlyByUserName};
