const AWS = require('aws-sdk');
const cron = require('node-cron');
const moment = require('moment');
const nodemailer = require('nodemailer');
const { Parser } = require('json2csv');
const User = require('../models/user');

// Configure AWS SDK
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

const s3 = new AWS.S3();

// Nodemailer transporter configuration
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD
    }
});

/**
 * Fetch data from S3 bucket.
 * @param {String} userName - The userName to filter data for.
 * @returns {Promise<Array>} - Parsed data from S3 file.
 */
const fetchDataFromS3 = async (userName) => {
    try {
        const key = 'average_data/averageData.json'; // S3 file key where data is stored
        const params = {
            Bucket: 'ems-ebhoom-bucket', // Your S3 bucket name
            Key: key
        };

        const s3Object = await s3.getObject(params).promise();
        const fileContent = s3Object.Body.toString('utf-8');

        // Parse JSON content
        const jsonData = JSON.parse(fileContent);

        // Filter data for the specific user
        const userData = jsonData.filter(entry => entry.userName === userName);
        console.log("Fetched S3 Data Length:", userData.length);

        return userData;
    } catch (error) {
        console.error('Error fetching data from S3:', error);
        throw new Error('Failed to fetch data from S3');
    }
};

/**
 * Send daily IoT data report via email.
 * @param {Object} user - The user to whom the data should be sent.
 */
const sendDataDaily = async (user) => {
    const today = moment().format('DD/MM/YYYY'); // Current date in the format stored in the DB
    const userName = user.userName;

    try {
        // Fetch data for today for the specific user from S3
        const data = await fetchDataFromS3(userName);

        // Filter data for today's date
        const todayData = data.filter(item => item.date === today);

        if (todayData.length === 0) {
            console.log(`No IoT data found for today for user ${userName}`);
            return;
        }

        // Reduce data to collect all unique keys in stackData
        const stackKeys = todayData.reduce((keys, entry) => {
            entry.stackData.forEach(stack => {
                Object.keys(stack).forEach(key => {
                    if (!keys.includes(key) && key !== '_id') keys.push(key);
                });
            });
            return keys;
        }, ['Date', 'Time', 'Stack Name']);

        // Prepare CSV data
        const csvData = todayData.flatMap(item =>
            item.stackData.map(stack => ({
                Date: item.date,
                Time: item.time,
                'Stack Name': stack.stackName,
                ...stack
            }))
        );

        const parser = new Parser({ fields: stackKeys });
        const csv = parser.parse(csvData);

        // Email setup
        const mailOptions = {
            from: '"IoT Data Service" <iot@example.com>',
            to: user.email,
            subject: 'Daily IoT Data Report',
            text: 'Please find attached the latest IoT data in CSV format.',
            attachments: [{
                filename: 'iotData.csv',
                content: csv
            }]
        };

        // Send email
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log(`Failed to send email to ${user.email}: ${error}`);
            } else {
                console.log(`Email successfully sent to ${user.email}: ${info.response}`);
            }
        });
    } catch (error) {
        console.error(`Error while fetching or sending IoT data for today for user ${userName}:`, error);
    }
};

// Scheduled function to send emails at 01:00 AM every day
// Schedule the daily email report at 01:00 AM IST
const scheduleDailyDataSend = () => {
    cron.schedule('*/5 * * * *', async () => {
        try {
            const users = await User.find({});
            users.forEach(user => sendDataDaily(user)); // Adjust sendDataDaily to reflect the new timing if necessary
        } catch (error) {
            console.error('Error fetching users for 15-minute data send:', error);
        }
    });
};




module.exports = { sendDataDaily, scheduleDailyDataSend };
