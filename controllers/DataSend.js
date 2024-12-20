const AWS = require('aws-sdk');
const cron = require('node-cron');
const moment = require('moment');
const nodemailer = require('nodemailer');
const { Parser } = require('json2csv');
const User = require('../models/user'); // User model

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
 * Fetch data from S3 bucket for the previous day.
 * @param {String} userName - The userName to filter data for.
 * @returns {Promise<Array>} - Parsed data from S3 file.
 */
const fetchDataFromS3 = async (userName) => {
    try {
        const key = 'average_data/averageData.json'; // S3 file key
        const params = {
            Bucket: 'ems-ebhoom-bucket',
            Key: key
        };

        const s3Object = await s3.getObject(params).promise();
        const fileContent = s3Object.Body.toString('utf-8');

        // Parse JSON content
        const jsonData = JSON.parse(fileContent);

        // Get start and end timestamps for the previous day
        const startOfDay = moment().subtract(1, 'day').startOf('day').toISOString();
        const endOfDay = moment().subtract(1, 'day').endOf('day').toISOString();

        // Filter data for the specific user and previous day
        const userData = jsonData.filter(entry =>
            entry.userName === userName &&
            moment(entry.timestamp).isBetween(startOfDay, endOfDay, null, '[]')
        );

        console.log(`Fetched S3 Data Length for ${userName}:`, userData.length);
        return userData;
    } catch (error) {
        console.error('Error fetching data from S3:', error);
        throw new Error('Failed to fetch data from S3');
    }
};

/**
 * Prepare CSV from fetched data, flattening stackData and excluding specific fields.
 * @param {Array} data - Data to convert to CSV.
 * @returns {String} - CSV formatted data.
 */
const prepareCSV = (data) => {
    const flattenedData = [];

    data.forEach(entry => {
        entry.stackData.forEach(stack => {
            const flattenedEntry = {
                ...entry,
                stackName: stack.stackName,
                ...stack.parameters
            };

            // Remove unwanted fields
            delete flattenedEntry.stackData;
            delete flattenedEntry._id;
            delete flattenedEntry.__v;
            delete flattenedEntry.timestamp;

            flattenedData.push(flattenedEntry);
        });
    });

    const fields = Object.keys(flattenedData[0] || {});
    const parser = new Parser({ fields });
    return parser.parse(flattenedData);
};

/**
 * Send daily IoT data report via email.
 * @param {Object} user - The user to whom the data should be sent.
 */
const sendDataDaily = async (user) => {
    const userName = user.userName;

    try {
        // Fetch data from S3
        const s3Data = await fetchDataFromS3(userName);

        if (s3Data.length === 0) {
            console.log(`No IoT data found for user ${userName}`);
            return;
        }

        // Prepare CSV data
        const csv = prepareCSV(s3Data);

        // Email setup
        const mailOptions = {
            from: '"IoT Data Service" <iot@example.com>',
            to: user.email,
            subject: 'Daily IoT Data Report',
            text: 'Please find attached the IoT data for the previous day in CSV format.',
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
        console.error(`Error while fetching or sending IoT data for user ${userName}:`, error);
    }
};

/**
 * Schedule the daily email report at 1:00 AM.
 */
const scheduleDailyDataSend = () => {
    // cron.schedule('0 1 * * *', async () => {
    //     try {
    //         // Fetch all users from the database
    //         const users = await User.find({}, { userName: 1, email: 1 });

    //         if (users.length === 0) {
    //             console.log("No users found to send daily IoT data reports.");
    //             return;
    //         }

    //         const emailPromises = users.map(user => sendDataDaily(user));
    //         await Promise.all(emailPromises);

    //         console.log("All daily IoT data reports for the previous day have been successfully sent!");
    //     } catch (error) {
    //         console.error('Error fetching users for daily data send:', error);
    //     }
    // });
};

module.exports = { sendDataDaily, scheduleDailyDataSend };