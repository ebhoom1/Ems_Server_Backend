
const Prediction = require('../models/PredictionOfConsumption');
const TotalPredictionSummary = require('../models/TotalPredictionSummary');
const User = require('../models/user');
const moment = require('moment-timezone');
const AWS = require('aws-sdk');
const cron = require('node-cron');

// Function to fetch user details
const fetchUserDetails = async (userName) => {
    return await User.findOne({ userName }).lean();
};

// Function to calculate and save total prediction summary from the last hourly data
const calculateTotalPredictionSummary = async () => {
    const currentTime = moment().startOf('hour');
    const previousHourTime = currentTime.clone().subtract(1, 'hour');

    const users = await Prediction.distinct("userName");
    console.log(`Processing predictions for the following users: ${users.join(", ")}`);

    for (const userName of users) {
        console.log(`Fetching user details for ${userName}`);
        const userDetails = await fetchUserDetails(userName);
        if (!userDetails) {
            console.log(`User details not found for ${userName}`);
            continue;
        }

        console.log(`Fetching predictions for ${userName} on ${previousHourTime.format('DD/MM/YYYY')} at hour ${previousHourTime.format('HH')}`);
        const latestPredictions = await Prediction.find({
            userName,
            date: previousHourTime.format('DD/MM/YYYY'),
            hour: previousHourTime.format('HH')
        }).lean();

        if (latestPredictions.length === 0) {
            console.log(`No predictions found for user ${userName} for hour ${previousHourTime.format('HH:mm')}`);
            continue;
        }

        let totalEnergy = 0;
        let totalFlow = 0;
        latestPredictions.forEach(prediction => {
            prediction.stacks.forEach(stack => {
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
            timestamp:new Date(),
        });

        await summaryEntry.save();
        console.log(`Total prediction summary saved for ${userName} for hour ${previousHourTime.format('HH:mm')}`);
    }
};

// Immediate function call to test
calculateTotalPredictionSummary();

// Schedule to run every hour   
cron.schedule('0 * * * *', () => {
    console.log('Running hourly total prediction summary calculation...');
    calculateTotalPredictionSummary();
});


const setupCronJobPredictionSummary= () => {
 // Schedule to run every hour
cron.schedule('0 * * * *', () => {
    console.log('Running hourly total prediction summary calculation...');
    calculateTotalPredictionSummary();
});
 };

 // Configure AWS SDK
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

const s3 = new AWS.S3();

// Helper Function to Fetch Data from S3
const fetchDataFromS3 = async (key) => {
    try {
        const params = {
            Bucket: 'ems-ebhoom-bucket', // Your S3 bucket name
            Key: key // File key in the bucket
        };
        const s3Object = await s3.getObject(params).promise();
        return JSON.parse(s3Object.Body.toString('utf-8'));
    } catch (error) {
        console.error('Error fetching data from S3:', error);
        throw new Error('Failed to fetch data from S3');
    }
};


// Function to get all prediction summary data  
const getAllPredictionSummaryData = async (req, res) => {
    try {
        // Fetch MongoDB data
        const mongoData = await TotalPredictionSummary.find().lean();

        // Fetch S3 data
        const s3Data = await fetchDataFromS3('totalPrediction_data/totalPredictionData.json');

        // Combine MongoDB and S3 data
        const combinedData = [...mongoData, ...s3Data];

        if (!combinedData.length) {
            return res.status(404).json({ message: 'No prediction summary data found.' });
        }

        res.status(200).json(combinedData);
    } catch (error) {
        console.error(`Error fetching all prediction summary data: ${error.message}`);
        res.status(500).json({ message: 'Internal server error', error });
    }
};

// Function to get prediction summary by userName
const getPredictionSummaryByUserName = async (req, res) => {
    const { userName } = req.params;

    try {
        // Fetch MongoDB data
        const mongoData = await TotalPredictionSummary.find({ userName }).lean();

        // Fetch S3 data
        const s3Data = await fetchDataFromS3('totalPrediction_data/totalPredictionData.json');
        const s3FilteredData = s3Data.filter(entry => entry.userName === userName);

        // Combine MongoDB and S3 data
        const combinedData = [...mongoData, ...s3FilteredData];

        if (!combinedData.length) {
            return res.status(404).json({ message: `No prediction summary data found for user: ${userName}` });
        }

        res.status(200).json(combinedData);
    } catch (error) {
        console.error(`Error fetching prediction summary for user ${userName}: ${error.message}`);
        res.status(500).json({ message: 'Internal server error', error });
    }
};


// Function to get prediction summary by userName and intervalType
const getPredictionSummaryByUserNameAndInterval = async (req, res) => {
    const { userName, intervalType } = req.params;

    try {
        // Fetch MongoDB data
        const mongoData = await TotalPredictionSummary.find({ userName, intervalType }).lean();

        // Fetch S3 data
        const s3Data = await fetchDataFromS3('totalPrediction_data/totalPredictionData.json');
        const s3FilteredData = s3Data.filter(
            (entry) => entry.userName === userName && entry.intervalType === intervalType
        );

        // Combine MongoDB and S3 data
        const combinedData = [...mongoData, ...s3FilteredData];

        if (!combinedData.length) {
            return res.status(404).json({
                message: `No prediction summary data found for user: ${userName} and interval: ${intervalType}`
            });
        }

        res.status(200).json(combinedData);
    } catch (error) {
        console.error(`Error fetching prediction summary for user ${userName} and interval ${intervalType}: ${error.message}`);
        res.status(500).json({ message: 'Internal server error', error });
    }
};

module.exports = { 
    calculateTotalPredictionSummary,
    setupCronJobPredictionSummary,
    getAllPredictionSummaryData,
    getPredictionSummaryByUserName,
    getPredictionSummaryByUserNameAndInterval,
};
