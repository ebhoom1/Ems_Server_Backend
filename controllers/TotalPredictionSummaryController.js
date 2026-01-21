const AWS = require('aws-sdk');
const moment = require('moment-timezone');
const cron = require('node-cron');
const TotalPredictionSummary = require('../models/TotalPredictionSummary');
const User = require('../models/user');

// Configure AWS SDK
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

// Helper Function: Fetch Data from S3
const fetchDataFromS3 = async (key) => {
    try {
        const params = {
            Bucket: 'goodfoot-ems-bucket',
            Key: key,
        };
        const s3Object = await s3.getObject(params).promise();
        return JSON.parse(s3Object.Body.toString('utf-8'));
    } catch (error) {
        console.error(`Error fetching data from S3 (${key}):`, error.message);
        throw new Error('Failed to fetch data from S3');
    }
};

// Helper Function: Fetch User Details
const fetchUserDetails = async (userName) => {
    try {
        return await User.findOne({ userName }).lean();
    } catch (error) {
        console.error(`Error fetching user details for ${userName}:`, error.message);
        return null;
    }
};

// Function: Calculate Total Prediction Summary from S3 Data
const calculateTotalPredictionSummaryFromS3 = async () => {
    try {
        const currentTime = moment().startOf('hour');
        const previousHourTime = currentTime.clone().subtract(1, 'hour');

        console.log(`Fetching prediction data from S3 for the time interval ${previousHourTime.format('DD/MM/YYYY HH')} - ${currentTime.format('DD/MM/YYYY HH')}`);

        // Fetch prediction data from S3 bucket
        const predictionData = await fetchDataFromS3('prediction_data/predictionData.json');

        if (!predictionData || predictionData.length === 0) {
            console.log('No prediction data available from S3.');
            return;
        }

        // Get distinct users from the prediction data
        const users = [...new Set(predictionData.map((entry) => entry.userName))];
        console.log(`Processing predictions for the following users: ${users.join(", ")}`);

        for (const userName of users) {
            console.log(`Fetching user details for ${userName}`);
            const userDetails = await fetchUserDetails(userName);
            if (!userDetails) {
                console.log(`User details not found for ${userName}`);
                continue;
            }

            console.log(`Filtering predictions for ${userName} on ${previousHourTime.format('DD/MM/YYYY')} at hour ${previousHourTime.format('HH')}`);

            // Filter predictions for the specific user, date, and hour
            const latestPredictions = predictionData.filter(
                (prediction) =>
                    prediction.userName === userName &&
                    prediction.date === previousHourTime.format('DD/MM/YYYY') &&
                    prediction.hour === previousHourTime.format('HH')
            );

            if (latestPredictions.length === 0) {
                console.log(`No predictions found for user ${userName} for hour ${previousHourTime.format('HH:mm')}`);
                continue;
            }

            let totalEnergy = 0;
            let totalFlow = 0;

            latestPredictions.forEach((prediction) => {
                prediction.stacks.forEach((stack) => {
                    console.log(`Adding ${stack.energyHourlyPrediction} energy and ${stack.flowHourlyPrediction} flow from ${stack.stackName}`);
                    totalEnergy += stack.energyHourlyPrediction || 0;
                    totalFlow += stack.flowHourlyPrediction || 0;
                });
            });

            console.log(`Total energy for ${userName}: ${totalEnergy}, Total flow: ${totalFlow}`);

            const summaryEntry = new TotalPredictionSummary({
                userName,
                product_id: userDetails.product_id,
                companyName: userDetails.companyName,
                email: userDetails.email,
                mobileNumber: userDetails.mobileNumber,
                date: previousHourTime.format('DD/MM/YYYY'),
                hour: previousHourTime.format('HH'),
                totalEnergyPrediction: totalEnergy,
                totalFlowPrediction: totalFlow,
                interval: `${previousHourTime.format('DD/MM/YYYY HH:mm:ss')} - ${currentTime.format('DD/MM/YYYY HH:mm:ss')}`,
                intervalType: 'hourly',
                timestamp: new Date(),
            });

            await summaryEntry.save();
            console.log(`Prediction summary saved for ${userName}: Energy=${totalEnergy}, Flow=${totalFlow}`);
        }
    } catch (error) {
        console.error('Error calculating total prediction summary from S3:', error.message);
    }
};


// Function: Get All Prediction Summary Data
const getAllPredictionSummaryData = async (req, res) => {
    try {
        const mongoData = await TotalPredictionSummary.find().lean();
        const s3Data = await fetchDataFromS3('totalPrediction_data/totalPredictionData.json');
        const combinedData = [...mongoData, ...s3Data];

        if (!combinedData.length) {
            return res.status(404).json({ message: 'No prediction summary data found.' });
        }

        res.status(200).json(combinedData);
    } catch (error) {
        console.error('Error fetching all prediction summary data:', error.message);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// Function: Get Prediction Summary by User Name
const getPredictionSummaryByUserName = async (req, res) => {
    const { userName } = req.params;

    try {
        const mongoData = await TotalPredictionSummary.find({ userName }).lean();
        const s3Data = await fetchDataFromS3('totalPrediction_data/totalPredictionData.json');
        const s3FilteredData = s3Data.filter(entry => entry.userName === userName);
        const combinedData = [...mongoData, ...s3FilteredData];

        if (!combinedData.length) {
            return res.status(404).json({ message: `No prediction summary data found for user: ${userName}` });
        }

        res.status(200).json(combinedData);
    } catch (error) {
        console.error(`Error fetching prediction summary for user ${userName}:`, error.message);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// Function: Get Prediction Summary by User Name and Interval
const getPredictionSummaryByUserNameAndInterval = async (req, res) => {
    const { userName, intervalType } = req.params;

    try {
        const mongoData = await TotalPredictionSummary.find({ userName, intervalType }).lean();
        const s3Data = await fetchDataFromS3('totalPrediction_data/totalPredictionData.json');
        const s3FilteredData = s3Data.filter(
            (entry) => entry.userName === userName && entry.intervalType === intervalType
        );
        const combinedData = [...mongoData, ...s3FilteredData];

        if (!combinedData.length) {
            return res.status(404).json({
                message: `No prediction summary data found for user: ${userName} and interval: ${intervalType}`,
            });
        }

        res.status(200).json(combinedData);
    } catch (error) {
        console.error(`Error fetching prediction summary for user ${userName} and interval ${intervalType}:`, error.message);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// Schedule: Run Prediction Calculation Every 5 Minutes
const setupPredictionSummaryCronJob = () => {
    cron.schedule('17 */1 * * *', () => {
        const currentTimeIST = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
        console.log(`Running prediction summary calculation from S3 at IST: ${currentTimeIST}`);
        calculateTotalPredictionSummaryFromS3();
    }, {
        timezone: 'Asia/Kolkata', // Ensure the cron job runs in IST
    });
};

module.exports = {
    calculateTotalPredictionSummaryFromS3,
    setupPredictionSummaryCronJob,
    getAllPredictionSummaryData,
    getPredictionSummaryByUserName,
    getPredictionSummaryByUserNameAndInterval,
};
