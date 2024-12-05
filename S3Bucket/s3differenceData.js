const AWS = require('aws-sdk');
const cron = require('node-cron');
const DifferenceData = require('../models/differeneceData');
const moment = require('moment');

// Configure AWS SDK
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

const s3 = new AWS.S3();

/**
 * Upload data to S3 and clear the uploaded data from the database.
 * @param {Date} startTime - Start time of the range.
 * @param {Date} endTime - End time of the range.
 * @param {String} s3Key - S3 file key to upload data.
 */
const uploadHourlyDataToS3 = async () => {
    try {
        const now = new Date();
        const oneHourFifteenMinutesAgo = new Date(now.getTime() - 75 * 60 * 1000); // 1 hour 15 minutes
        const s3Key = 'difference_data/hourlyDifferenceData.json';

        console.log('Starting hourly upload to S3...');
        
        // Fetch data from the MongoDB collection for the specified time range
        const data = await DifferenceData.find({
            timestamp: { $gte: oneHourFifteenMinutesAgo, $lte: now }
        }).lean();

        if (!data || data.length === 0) {
            console.log('No hourly data found for the specified time range.');
            return;
        }

        console.log(`Found ${data.length} hourly records.`);

        // Prepare S3 parameters
        const params = {
            Bucket: 'ems-ebhoom-bucket', // Replace with your S3 bucket name
            Key: s3Key,
        };

        let updatedData = data;

        // Check if the S3 file already exists
        try {
            const existingFile = await s3.getObject(params).promise();
            const existingData = JSON.parse(existingFile.Body.toString('utf-8'));
            updatedData = [...existingData, ...data];
        } catch (err) {
            if (err.code !== 'NoSuchKey') {
                console.error(`Error reading existing S3 file (${s3Key}):`, err);
                throw err;
            }
            console.log(`No existing S3 file found. A new file will be created.`);
        }

        // Upload data to S3
        await s3.upload({
            Bucket: 'ems-ebhoom-bucket',
            Key: s3Key,
            Body: JSON.stringify(updatedData, null, 2), // Pretty-printed JSON
            ContentType: 'application/json',
        }).promise();

        console.log('Hourly data uploaded to S3 successfully.');

        // Clear data from MongoDB
        const deleteResult = await DifferenceData.deleteMany({
            timestamp: { $gte: oneHourFifteenMinutesAgo, $lte: now }
        });
        console.log(`Deleted ${deleteResult.deletedCount} hourly records from MongoDB.`);
    } catch (err) {
        console.error('Error in uploading hourly data to S3:', err);
    }
};

/**
 * Schedule the job for hourly uploads
 */
const setupCronJobsForHourlyS3Upload = () => {
    // Hourly job: Runs every 1 hour and 15 minutes
    cron.schedule('15 */1 * * *', uploadHourlyDataToS3);
    console.log('Hourly S3 upload scheduled every 1 hour and 15 minutes.');
};

module.exports = {
    setupCronJobsForHourlyS3Upload,
    uploadHourlyDataToS3,
};
