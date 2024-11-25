const AWS = require('aws-sdk');
const cron = require('node-cron');
const predictionData = require('../models/PredictionOfConsumption');
const moment = require('moment');

// Configure AWS SDK
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

const s3 = new AWS.S3();

// Function to fetch data, append to JSON, and upload it to S3
const uploadDataToS3AndClearDB = async () => {
    try {
        const now = new Date();
        const startOfHour = new Date(now.setMinutes(0, 0, 0)); // Start of the current hour
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000); // One hour ago

        console.log(`Fetching data created between ${oneHourAgo} and ${now}`);
        
        // Fetch all data from the last hour up to the current time
        const data = await predictionData.find({ createdAt: { $gte: oneHourAgo, $lte: now } }).lean();

        if (data.length === 0) {
            console.log('No data found for the last hour.');
            return;
        }

        console.log(`Fetched ${data.length} records for S3 upload.`);

        const fileName = 'prediction_data/predictionData.json';

        try {
            const s3Params = {
                Bucket: 'ems-ebhoom-bucket',
                Key: fileName
            };

            const existingFile = await s3.getObject(s3Params).promise();
            const existingJsonData = JSON.parse(existingFile.Body.toString('utf-8'));

            const updatedJsonData = [...existingJsonData, ...data];

            const uploadParams = {
                Bucket: 'ems-ebhoom-bucket',
                Key: fileName,
                Body: JSON.stringify(updatedJsonData, null, 2),
                ContentType: 'application/json'
            };

            await s3.upload(uploadParams).promise();
            console.log('Updated JSON file uploaded to S3:', fileName);
        } catch (getError) {
            if (getError.code === 'NoSuchKey') {
                const uploadParams = {
                    Bucket: 'ems-ebhoom-bucket',
                    Key: fileName,
                    Body: JSON.stringify(data, null, 2),
                    ContentType: 'application/json'
                };

                await s3.upload(uploadParams).promise();
                console.log('New JSON file created and uploaded to S3:', fileName);
            } else {
                console.error('Error fetching existing JSON from S3:', getError);
                return;
            }
        }

        const deleteResult = await predictionData.deleteMany({ createdAt: { $gte: oneHourAgo, $lte: now } });
        console.log(`Deleted ${deleteResult.deletedCount} records from MongoDB for the last hour.`);
    } catch (error) {
        console.error('Error in uploading data to S3 and clearing DB:', error);
    }
};

// Schedule the job to run every hour at the top of the hour
const setupCronJobS3PredictionData = () => {
    cron.schedule('15 * * * *', () => {
        console.log('Running hourly prediction data upload and cleanup...');
        uploadDataToS3AndClearDB();
    });
};

module.exports = { uploadDataToS3AndClearDB, setupCronJobS3PredictionData };
