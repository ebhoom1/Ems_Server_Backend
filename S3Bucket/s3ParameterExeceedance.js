const AWS = require('aws-sdk');
const cron = require('node-cron');
const parmaterExceedance = require('../models/calibrationExceed');
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

        // Fetch all data from the last hour up to the current time
        const data = await parmaterExceedance.find({ timestamp: { $gte: oneHourAgo, $lte: now } }).lean();

        if (data.length === 0) {
            console.log('No data found for the last hour.');
            return;
        }

        // Prepare the JSON data to be added to the existing file
        const newJsonData = data;

        // Prepare the S3 parameters
        const fileName = 'parameterExceed_data/exceedData.json';

        try {
            // Attempt to get the existing file from S3
            const s3Params = {
                Bucket: 'ems-ebhoom-bucket', // Your bucket name
                Key: fileName
            };

            const existingFile = await s3.getObject(s3Params).promise();
            const existingJsonData = JSON.parse(existingFile.Body.toString('utf-8'));

            // Append the new data to the existing data
            const updatedJsonData = [...existingJsonData, ...newJsonData];

            // Upload the updated JSON to S3
            const uploadParams = {
                Bucket: 'ems-ebhoom-bucket',
                Key: fileName,
                Body: JSON.stringify(updatedJsonData, null, 2), // Pretty print JSON
                ContentType: 'application/json'
            };

            await s3.upload(uploadParams).promise();
            console.log('Updated JSON file uploaded to S3:', fileName);
        } catch (getError) {
            // If the file does not exist (NoSuchKey error), create a new one
            if (getError.code === 'NoSuchKey') {
                // Upload the new data as a new file
                const uploadParams = {
                    Bucket: 'ems-ebhoom-bucket',
                    Key: fileName,
                    Body: JSON.stringify(newJsonData, null, 2), // Pretty print JSON
                    ContentType: 'application/json'
                };

                await s3.upload(uploadParams).promise();
                console.log('New JSON file created and uploaded to S3:', fileName);
            } else {
                // Handle other errors
                console.error('Error fetching existing JSON from S3:', getError);
                return;
            }
        }

        // Delete the uploaded data from MongoDB
        const deleteResult = await parmaterExceedance.deleteMany({ timestamp: { $gte: oneHourAgo, $lte: now } });
        console.log(`Deleted ${deleteResult.deletedCount} records from MongoDB for the last hour.`);
    } catch (error) {
        console.error('Error in uploading data to S3 and clearing DB:', error);
    }
};

// Schedule the job to run every hour at the top of the hour
const setupCronJobS3ParameterExceed = () => {
    cron.schedule('0 * * * *', () => {
        console.log('Running hourly data upload and cleanup...');
        uploadDataToS3AndClearDB();
    });
};

module.exports = { uploadDataToS3AndClearDB, setupCronJobS3ParameterExceed };
