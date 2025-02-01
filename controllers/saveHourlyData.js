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

const fetchDataFromS3 = async (key) => {
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
};

const getHourlyDataOfCumulatingFlowAndEnergy = async (req, res) => {
    const { userName, date } = req.query;

    if (!userName || !date) {
        return res.status(400).json({
            success: false,
            message: '❌ Missing required query parameters (userName, date).',
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
                message: '❌ Date format is invalid. Use YYYY, MM, or DD/MM/YYYY format.',
            });
        }

        // 🔥 Corrected MongoDB Query with `$unwind: "$stackData"`
        const results = await HourlyData.aggregate([
            { $match: { userName: userName, ...dateQuery } },
            { $unwind: "$stackData" }, // 🔥 Fixes previous error
            {
                $group: {
                    _id: { hour: "$hour", stackName: "$stackData.stackName" },
                    latestEntry: { $last: "$stackData" }, // 🔥 Fetches last entry for each stack
                    date: { $last: "$date" },
                    userName: { $last: "$userName" },
                },
            },
            { $sort: { "_id.hour": 1 } },
        ]);

        console.log(`📊 MongoDB Query Results for user: ${userName}, date: ${date}`, results);

        if (results.length > 0) {
            return res.status(200).json({
                success: true,
                data: results.map((item) => ({
                    hour: item._id.hour,
                    date: item.date,
                    userName: item.userName,
                    stack: item.latestEntry,
                })),
            });
        }

        console.log('⚠️ No data found in MongoDB. Fetching from S3...');

        // Fetch from S3 if no data in MongoDB
        const s3Data = await fetchDataFromS3('hourly_data/hourlyData.json');

        const filteredS3Data = s3Data.filter(
            (entry) => entry.userName === userName && entry.date === date
        );

        console.log(`📂 Filtered S3 Data:`, filteredS3Data);

        if (filteredS3Data.length === 0) {
            return res.status(404).json({
                success: false,
                message: '❌ No data found in MongoDB or S3 for the given parameters.',
            });
        }

        return res.status(200).json({
            success: true,
            data: filteredS3Data.map((entry) => ({
                hour: entry.hour,
                date: entry.date,
                userName: entry.userName,
                stacks: entry.stackData, // 🔥 Ensuring we return `stackData`
            })),
        });
    } catch (error) {
        console.error('❌ Error fetching hourly data:', error);
        res.status(500).json({
            success: false,
            message: '❌ Internal server error while fetching data.',
            error: error.message,
        });
    }
};


module.exports = { setupCronJob, getHourlyDataOfCumulatingFlowAndEnergy };
