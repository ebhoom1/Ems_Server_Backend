const AWS = require('aws-sdk');
const cron = require('node-cron');
const report = require('../models/report');
const moment = require('moment-timezone');

// Configure AWS SDK
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

const s3 = new AWS.S3();

const uploadDataToS3AndClearDB = async () => {
    try {
        const now = new Date();
        const startOfHour = new Date(now.setMinutes(0, 0, 0)); // Start of the current hour
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000); // One hour ago

        console.log(`Fetching data between ${oneHourAgo} and ${now}`);
        
        // Fetch data from MongoDB
        const data = await report.find({ timestamp: { $gte: oneHourAgo, $lte: now } }).lean();

        if (data.length === 0) {
            console.log('No report data found for the last hour.');
            return;
        }
        console.log(`Fetched ${data.length} records for S3 upload.`);

        const fileName = 'report_data/reportData.json';

        try {
            const s3Params = {
                Bucket: 'goodfoot-ems-bucket',
                Key: fileName,
            };

            const existingFile = await s3.getObject(s3Params).promise();
            const existingJsonData = JSON.parse(existingFile.Body.toString('utf-8'));

            const updatedJsonData = [...existingJsonData, ...data];

            const uploadParams = {
                Bucket: 'goodfoot-ems-bucket',
                Key: fileName,
                Body: JSON.stringify(updatedJsonData, null, 2),
                ContentType: 'application/json',
            };

            await s3.upload(uploadParams).promise();
            console.log('Updated JSON file uploaded to S3:', fileName);
        } catch (getError) {
            if (getError.code === 'NoSuchKey') {
                const uploadParams = {
                    Bucket: 'goodfoot-ems-bucket',
                    Key: fileName,
                    Body: JSON.stringify(data, null, 2),
                    ContentType: 'application/json',
                };

                await s3.upload(uploadParams).promise();
                console.log('New JSON file created and uploaded to S3:', fileName);
            } else {
                console.error('Error fetching or uploading to S3:', getError);
                return;
            }
        }

        const deleteResult = await report.deleteMany({ timestamp: { $gte: oneHourAgo, $lte: now } });
        console.log(`Deleted ${deleteResult.deletedCount} records from MongoDB for the last hour.`);
    } catch (error) {
        console.error('Error in uploading report data to S3 and clearing DB:', error);
    }
};

// Schedule the job to run every hour at the top of the hour
const setupCronJobS3Report = () => {
    cron.schedule('0 * * * *', () => { // Runs at the start of every hour
        const currentTimeIST = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
        console.log(`Running hourly report data upload and cleanup at IST: ${currentTimeIST}`);
        uploadDataToS3AndClearDB();
    }, {
        timezone: 'Asia/Kolkata', // Ensures the cron job runs in IST
    });
};


module.exports = { uploadDataToS3AndClearDB, setupCronJobS3Report };
