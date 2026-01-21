const AWS = require('aws-sdk');
const cron = require('node-cron');
const moment = require('moment-timezone');
const TotalConsumptionSummary = require('../models/TotalConsumptionSummary');
const User = require('../models/user');

// Configure AWS SDK
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

/**
 * Helper Function: Fetch Data from S3
 * @param {String} key - S3 file key
 * @returns {Array} - Parsed JSON data from S3
 */
const fetchDataFromS3 = async (key) => {
    try {
        const params = {
            Bucket: 'goodfoot-ems-bucket', // Your S3 bucket name
            Key: key, // File key in the bucket
        };
        const s3Object = await s3.getObject(params).promise();
        return JSON.parse(s3Object.Body.toString('utf-8'));
    } catch (error) {
        if (error.code === 'NoSuchKey') {
            console.error(`S3 file not found: ${key}`);
        } else {
            console.error(`Error fetching data from S3 (${key}):`, error);
        }
        return [];
    }
};

/**
 * Helper Function: Fetch User Details
 * @param {String} userName - User's name
 * @returns {Object} - User details from MongoDB
 */
const fetchUserDetails = async (userName) => {
    return await User.findOne({ userName }).lean();
};

/**
 * Function: Calculate and Save Total Consumption Summary from Hourly Data (S3)
 */
const calculateTotalConsumptionFromLastEntryS3 = async () => {
    try {
        const hourlyData = await fetchDataFromS3('hourly_data/hourlyData.json');

        if (!hourlyData || hourlyData.length === 0) {
            console.log('No hourly data available from S3.');
            return;
        }

        const groupedData = hourlyData.reduce((acc, entry) => {
            if (!acc[entry.userName]) acc[entry.userName] = [];
            acc[entry.userName].push(entry);
            return acc;
        }, {});

        for (const [userName, userData] of Object.entries(groupedData)) {
            const latestData = userData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

            if (!latestData) {
                console.log(`No data found for user ${userName}`);
                continue;
            }

            const userDetails = await fetchUserDetails(userName);
            if (!userDetails) {
                console.log(`User details not found for ${userName}`);
                continue;
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
                timestamp: new Date(),
            });

            await summaryEntry.save();
            console.log(`Total consumption summary saved for ${userName}: Energy=${totalEnergy}, Flow=${totalCumulatingFlow}`);
        }
    } catch (error) {
        console.error('Error calculating total consumption from last entry:', error);
    }
};

/**
 * Schedule Cron Job: Calculate Total Consumption Summary (S3)
 */
const setupCronJobTotalSummaryS3 = () => {
    cron.schedule('18 */1 * * *', () => {
        const currentTimeIST = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
        console.log(`Running total consumption summary calculation from S3 at IST: ${currentTimeIST}`);
        calculateTotalConsumptionFromLastEntryS3();
    }, {
        timezone: 'Asia/Kolkata', // Ensure the cron job runs in IST
    });
};

/**
 * API: Get All Total Consumption Summaries (MongoDB + S3)
 */
const getAllSummary = async (req, res) => {
    try {
        const mongoData = await TotalConsumptionSummary.find().lean();
        const s3Data = await fetchDataFromS3('totalConsumption_data/totalConsumptionData.json');
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

/**
 * API: Get Total Consumption Summary by UserName (MongoDB + S3)
 */
const getSummaryByUserName = async (req, res) => {
    const { userName } = req.params;

    try {
        const mongoData = await TotalConsumptionSummary.findOne({ userName }).sort({ createdAt: -1 }).lean();
        const s3Data = await fetchDataFromS3('totalConsumption_data/totalConsumptionData.json');
        const s3FilteredData = s3Data.filter(entry => entry.userName === userName);

        const combinedData = [];
        if (mongoData) combinedData.push(mongoData);
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

/**
 * API: Get Total Consumption Summary by UserName and IntervalType (MongoDB + S3)
 */
const getSummaryByUserNameAndInterval = async (req, res) => {
    const { userName, intervalType } = req.params;

    try {
        const mongoData = await TotalConsumptionSummary.find({ userName, intervalType }).lean();
        const s3Data = await fetchDataFromS3('totalConsumption_data/totalConsumptionData.json');
        const s3FilteredData = s3Data.filter(
            entry => entry.userName === userName && entry.intervalType === intervalType
        );

        const combinedData = [...mongoData, ...s3FilteredData];

        if (!combinedData.length) {
            return res.status(404).json({
                message: `No summary data found for user ${userName} and interval type ${intervalType}.`,
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

/**
 * Exports
 */
module.exports = {
    setupCronJobTotalSummaryS3,
    getAllSummary,
    getSummaryByUserName,
    getSummaryByUserNameAndInterval,
};
