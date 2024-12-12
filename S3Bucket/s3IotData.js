const AWS = require('aws-sdk');
const cron = require('node-cron');
const IotData = require('../models/iotData');
const moment = require('moment-timezone');

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
        const startOfHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
        const oneHourAgo = new Date(startOfHour.getTime() - 60 * 60 * 1000);

        // Fetch data from MongoDB
        const data = await IotData.find({ timestamp: { $gte: oneHourAgo, $lte: startOfHour } }).lean();
        console.log(`Fetched ${data.length} records from MongoDB.`);

        if (data.length === 0) return;

        const fileName = `iot_data/iotData_${moment().tz('Asia/Kolkata').format('YYYY-MM-DD_HH')}.json`;
        let existingJsonData = [];

        try {
            // Fetch existing file
            const existingFile = await s3.getObject({ Bucket: 'ems-ebhoom-bucket', Key: fileName }).promise();
            existingJsonData = JSON.parse(existingFile.Body.toString('utf-8'));
        } catch (error) {
            if (error.code !== 'NoSuchKey') {
                console.error('Error fetching S3 file:', error);
                return;
            }
            console.log('No existing S3 file found. Creating a new one.');
        }

        // Append new data to existing JSON
        const updatedJsonData = [...existingJsonData, ...data];
        const jsonString = JSON.stringify(updatedJsonData, null, 2);

        // Multipart upload for large files
        const uploadId = (await s3.createMultipartUpload({
            Bucket: 'ems-ebhoom-bucket',
            Key: fileName,
            ContentType: 'application/json',
        }).promise()).UploadId;

        const partSize = 5 * 1024 * 1024; // 5MB parts
        const parts = [];
        for (let i = 0; i < jsonString.length; i += partSize) {
            const part = jsonString.slice(i, i + partSize);
            const partNum = Math.ceil(i / partSize) + 1;

            const uploadPartResponse = await s3.uploadPart({
                Bucket: 'ems-ebhoom-bucket',
                Key: fileName,
                PartNumber: partNum,
                UploadId: uploadId,
                Body: part,
            }).promise();

            parts.push({ ETag: uploadPartResponse.ETag, PartNumber: partNum });
        }

        await s3.completeMultipartUpload({
            Bucket: 'ems-ebhoom-bucket',
            Key: fileName,
            UploadId: uploadId,
            MultipartUpload: { Parts: parts },
        }).promise();

        console.log('Multipart upload completed for iot_data.json.');

        // Delete data from MongoDB
        const deleteResult = await IotData.deleteMany({ timestamp: { $gte: oneHourAgo, $lte: startOfHour } });
        console.log(`Deleted ${deleteResult.deletedCount} records from MongoDB.`);
    } catch (error) {
        console.error('Error in uploadDataToS3AndClearDB:', error);
    }
};


// Schedule the job to run every 2 minutes
const setupCronJobS3 = () => {
    cron.schedule('0 * * * *', () => {
        const currentTimeIST = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
        console.log(`Running data upload and cleanup at IST: ${currentTimeIST}`);
        uploadDataToS3AndClearDB();
    }, {
        timezone: 'Asia/Kolkata', // Ensures the cron job runs in IST
    });
};

module.exports = { uploadDataToS3AndClearDB, setupCronJobS3 };
