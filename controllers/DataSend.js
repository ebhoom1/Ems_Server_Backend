const moment = require('moment'); // ensure moment is installed
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const { Parser } = require('json2csv');
const IotData = require('../models/iotData');
const User = require('../models/user');

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

// Function to fetch IoT data for a specific user and send it via email
const sendDataDaily = async (user) => {
    const today = moment().format('DD/MM/YYYY'); // Current date in the format stored in the DB

    try {
        // Fetch data for today, for a specific user
        const data = await IotData.find({
            userName: user.userName,
            date: today // Matches date format in the database
        }).sort('time').lean(); // Sorting by time if multiple entries per day

        if (data.length === 0) {
            console.log(`No IoT data found for today for user ${user.userName}`);
            return;
        }

        // Reduce data to collect all unique keys in stackData
        const stackKeys = data.reduce((keys, entry) => {
            entry.stackData.forEach(stack => {
                Object.keys(stack).forEach(key => {
                    if (!keys.includes(key) && key !== '_id') keys.push(key);
                });
            });
            return keys;
        }, ['Date', 'Time', 'Stack Name']);

        // Prepare CSV data
        const csvData = data.flatMap(item =>
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
        console.error(`Error while fetching or sending IoT data for today for user ${user.userName}:`, error);
    }
};

// Scheduled function to send emails every 15 minutes and at midnight
const scheduleIotDataEmails = () => {
    cron.schedule('55 23 * * *', async () => { 
        const users = await User.find({});
        users.forEach(user => {
            sendDataDaily(user);
        });
    });
}

module.exports = { scheduleIotDataEmails,sendDataDaily  };


