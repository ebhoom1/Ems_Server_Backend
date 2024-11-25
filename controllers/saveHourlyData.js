const moment = require('moment');
const cron = require('node-cron');
const AWS = require('aws-sdk');

const HourlyData = require('../models/hourlyData'); // Adjust path as necessary
const IotData = require('../models/iotData'); // Assuming the model is named IotData and imported accordingly
const {calculateAndSaveConsumption} = require('./consumption');

const saveHourlyData = async () => {
    const hour = moment().subtract(1, 'hours').format('HH');
    const startOfHour = moment().startOf('hour').subtract(1, 'hour');
    const endOfHour = moment(startOfHour).endOf('hour');
  
    console.log(`Initiating hourly data save for hour: ${hour}`);

    try {
        const lastEntries = await IotData.aggregate([
            {
                $match: {
                    timestamp: { $gte: startOfHour.toDate(), $lte: endOfHour.toDate() },
                    'stackData.stationType': { $in: ['energy', 'effluent_flow'] }
                }
            },
            {
                $sort: { timestamp: -1 }
            },
            {
                $group: {
                    _id: '$userName', // Group by user
                    latestEntry: { $first: '$$ROOT' }
                }
            },
            {
                $replaceRoot: { newRoot: "$latestEntry" }
            }
        ]);

        console.log(`Found ${lastEntries.length} entries to process.`);

        for (let entry of lastEntries) {
            const stacks = entry.stackData.filter(stack => stack.stationType === 'energy' || stack.stationType === 'effluent_flow');

            const hourlyRecord = {
                userName: entry.userName,
                product_id: entry.product_id,
                hour,
                date: moment(entry.timestamp).format('DD/MM/YYYY'),
                month: moment(entry.timestamp).format('MM'), // Save the month
                year: moment(entry.timestamp).format('YYYY'), // Save the year
                stacks: stacks.map(stack => ({
                    stackName: stack.stackName,
                    stationType: stack.stationType,
                    energy: stack.energy,
                    cumulatingFlow: stack.cumulatingFlow
                })),
                timestamp: new Date()
            };

            const hourlyData = new HourlyData(hourlyRecord);
            await hourlyData.save();
  
            //calculate it automatically it run
            calculateAndSaveConsumption();
            console.log(`Hourly data saved for user: ${entry.userName} at hour: ${hour}`);
        }
    } catch (error) {
        console.error('Error saving hourly data:', error);
    }
};

// Schedule the task to run at the beginning of every hour
// Function to setup cron job
const setupCronJob = () => {
    // Schedule the task to run at the beginning of every hour
    cron.schedule('0 * * * *', async () => {
        console.log('Cron job triggered: saveHourlyData');
        await saveHourlyData();
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
            Bucket: 'ems-ebhoom-bucket', // Your S3 bucket name
            Key: key, // File key in the bucket
        };

        const data = await s3.getObject(params).promise();
        return JSON.parse(data.Body.toString('utf-8'));
    } catch (error) {
        console.error('Error fetching data from S3:', error);
        throw new Error('Failed to fetch data from S3');
    }
};

const getHourlyDataOfCumulatingFlowAndEnergy = async (req, res) => {
    const { userName, stackName, date } = req.query;

    if (!userName || !stackName || !date) {
        return res.status(400).json({
            success: false,
            message: 'Missing required query parameters (userName, stackName, date).',
        });
    }

    try {
        const dateQuery = {};
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
                message: 'Date format is invalid. Use YYYY, MM, or DD/MM/YYYY format.',
            });
        }

        // Fetch data from MongoDB
        const results = await HourlyData.aggregate([
            {
                $match: {
                    userName: userName,
                    ...dateQuery,
                    "stacks.stackName": stackName,
                },
            },
            {
                $unwind: "$stacks",
            },
            {
                $match: {
                    "stacks.stackName": stackName,
                },
            },
            {
                $group: {
                    _id: {
                        hour: "$hour",
                        stackName: "$stacks.stackName",
                    },
                    latestEntry: { $last: "$stacks" },
                    date: { $last: "$date" },
                    userName: { $last: "$userName" },
                },
            },
            {
                $sort: { "_id.hour": 1 },
            },
        ]);

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

        console.log('No data found in MongoDB. Fetching from S3...');
        // Fetch from S3 if no data in MongoDB
        const s3Data = await fetchDataFromS3('hourly_data/hourlyData.json');
        const filteredS3Data = s3Data.filter(
            (entry) =>
                entry.userName === userName &&
                entry.stacks.some((stack) => stack.stackName === stackName) &&
                entry.date === date
        );

        if (filteredS3Data.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No data found for the provided parameters in MongoDB or S3.',
            });
        }

        return res.status(200).json({
            success: true,
            data: filteredS3Data.map((entry) => ({
                hour: entry.hour,
                date: entry.date,
                userName: entry.userName,
                stack: entry.stacks.find((stack) => stack.stackName === stackName),
            })),
        });
    } catch (error) {
        console.error('Error fetching hourly data:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching data',
            error: error.message,
        });
    }
};

    


module.exports = { setupCronJob,getHourlyDataOfCumulatingFlowAndEnergy };
