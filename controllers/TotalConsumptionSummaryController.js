
const Consumption = require('../models/Consumption');
const TotalConsumptionSummary = require('../models/TotalConsumptionSummary');
const moment = require('moment-timezone');
const cron = require('node-cron');
const HourlyData = require('../models/hourlyData');
const User = require('../models/user');
const AWS = require('aws-sdk');



// Helper function to fetch user details
const fetchUserDetails = async (userName) => {
    return await User.findOne({ userName }).lean();
};

// Function to calculate and save total consumption summary for the last entry
const calculateTotalConsumptionFromLastEntry = async () => {
    const users = await HourlyData.distinct("userName");
    for (const userName of users) {
        const latestData = await HourlyData.findOne({ userName }).sort({ date: -1, hour: -1 }).exec();
        if (!latestData) {
            console.log(`No data found for user ${userName}`);
            return;
        }

        const userDetails = await fetchUserDetails(userName);
        if (!userDetails) {
            console.log(`User details not found for ${userName}`);
            return;
        }

        let totalEnergy = 0;
        let totalCumulatingFlow = 0;
        latestData.stacks.forEach(stack => {
            totalEnergy += stack.energy || 0;
            totalCumulatingFlow += stack.cumulatingFlow || 0;
        });

        const intervalType = 'hourly';
        const interval = moment().subtract(1, 'hours').format('DD/MM/YYYY HH:mm:ss ddd');
        const date = moment().format('DD/MM/YYYY');

        const summaryEntry = new TotalConsumptionSummary({
            userName: userName,
            product_id: latestData.product_id,
            companyName: userDetails.companyName,
            email: userDetails.email,
            mobileNumber: userDetails.mobileNumber,
            interval: interval,
            intervalType: intervalType,
            totalEnergy: totalEnergy,
            totalCumulatingFlow: totalCumulatingFlow,
            date: date,
            timestamp:new Date()
        });

        await summaryEntry.save();
        console.log(`Total consumption summary saved for ${userName}: Energy=${totalEnergy}, Flow=${totalCumulatingFlow}`);
    }
};


const setupCronJobTotalSummary = () => {
   // Schedule the summary calculation to run every hour on the hour
cron.schedule('0 * * * *', () => {
    console.log('Running hourly total consumption summary calculation...');
    calculateTotalConsumptionFromLastEntry();
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

// Get all total consumption summaries
const getAllSummary = async (req, res) => {
    try {
        // Fetch MongoDB data
        const mongoData = await TotalConsumptionSummary.find().lean();

        // Fetch S3 data
        const s3Data = await fetchDataFromS3('totalConsumption_data/totalConsumptionData.json');

        // Combine MongoDB and S3 data
        const combinedData = [...mongoData, ...s3Data];

        if (!combinedData.length) {
            return res.status(404).json({ message: 'No summary data available.' });
        }

        res.status(200).json(combinedData);
    } catch (error) {
        console.error('Error fetching all summary data:', error);
        res.status(500).json({ message: 'Internal server error.', error });
    }
};

// Get total consumption summary by userName
const getSummaryByUserName = async (req, res) => {
    const { userName } = req.params;

    try {
        // Fetch MongoDB data
        const mongoData = await TotalConsumptionSummary.findOne({ userName })
            .sort({ createdAt: -1 })
            .lean(); // Sorts by `createdAt` in descending order

        // Fetch S3 data
        const s3Data = await fetchDataFromS3('totalConsumption_data/totalConsumptionData.json');
        const s3FilteredData = s3Data.filter(entry => entry.userName === userName);

        // Combine MongoDB and S3 data
        const combinedData = [];
        if (mongoData) {
            combinedData.push(mongoData);
        }
        combinedData.push(...s3FilteredData);

        if (!combinedData.length) {
            return res.status(404).json({ message: `No summary data found for user ${userName}.` });
        }

        res.status(200).json(combinedData);
    } catch (error) {
        console.error(`Error fetching summary data for user ${userName}:`, error);
        res.status(500).json({ message: 'Internal server error.', error });
    }
};



// Get total consumption summary by userName and intervalType
const getSummaryByUserNameAndInterval = async (req, res) => {
    const { userName, intervalType } = req.params;

    try {
        // Fetch MongoDB data
        const mongoData = await TotalConsumptionSummary.find({ userName, intervalType }).lean();

        // Fetch S3 data
        const s3Data = await fetchDataFromS3('totalConsumption_data/totalConsumptionData.json');
        const s3FilteredData = s3Data.filter(
            (entry) => entry.userName === userName && entry.intervalType === intervalType
        );

        // Combine MongoDB and S3 data
        const combinedData = [...mongoData, ...s3FilteredData];

        if (!combinedData.length) {
            return res.status(404).json({
                message: 'No summary data found for the specified user and interval type.',
            });
        }

        res.status(200).json(combinedData);
    } catch (error) {
        console.error(
            `Error fetching summary data for user ${userName} and interval type ${intervalType}:`,
            error
        );
        res.status(500).json({ message: 'Internal server error.', error });
    }
};


module.exports = { 
    // scheduleTotalConsumptionSummaryCalculation, 
    //calculateTotalConsumptionSummary, 
    setupCronJobTotalSummary,
    getAllSummary,
    getSummaryByUserName,
    getSummaryByUserNameAndInterval,
};
