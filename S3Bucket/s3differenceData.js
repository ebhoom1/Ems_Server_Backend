// const AWS = require('aws-sdk');
// const cron = require('node-cron');
// const difference = require('../models/differeneceData');
// const moment = require('moment');

// // Configure AWS SDK
// AWS.config.update({
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//     region: process.env.AWS_REGION
// });

// const s3 = new AWS.S3();

// // Function to fetch weekly data, append to JSON, and upload it to S3
// const uploadWeeklyDataToS3AndClearDB = async () => {
//     try {
//         const now = new Date();
//         const startOfWeek = new Date(now.setDate(now.getDate() - 7)); // 7 days ago

//         // Fetch all data from the past week up to the current time
//         const data = await difference.find({ timestamp: { $gte: startOfWeek, $lte: now } }).lean();

//         if (data.length === 0) {
//             console.log('No data found for the past week.');
//             return;
//         }

//         // Prepare the JSON data to be added to the existing file
//         const newJsonData = data;

//         // Prepare the S3 parameters
//         const fileName = 'difference_data/weeklyDifferenceData.json';

//         try {
//             // Attempt to get the existing file from S3
//             const s3Params = {
//                 Bucket: 'ems-ebhoom-bucket', // Your bucket name
//                 Key: fileName
//             };

//             const existingFile = await s3.getObject(s3Params).promise();
//             const existingJsonData = JSON.parse(existingFile.Body.toString('utf-8'));

//             // Append the new data to the existing data
//             const updatedJsonData = [...existingJsonData, ...newJsonData];

//             // Upload the updated JSON to S3
//             const uploadParams = {
//                 Bucket: 'ems-ebhoom-bucket',
//                 Key: fileName,
//                 Body: JSON.stringify(updatedJsonData, null, 2), // Pretty print JSON
//                 ContentType: 'application/json',
//             };

//             await s3.upload(uploadParams).promise();
//             console.log('Updated weekly JSON file uploaded to S3:', fileName);
//         } catch (getError) {
//             // If the file does not exist (NoSuchKey error), create a new one
//             if (getError.code === 'NoSuchKey') {
//                 // Upload the new data as a new file
//                 const uploadParams = {
//                     Bucket: 'ems-ebhoom-bucket',
//                     Key: fileName,
//                     Body: JSON.stringify(newJsonData, null, 2), // Pretty print JSON
//                     ContentType: 'application/json'
//                 };

//                 await s3.upload(uploadParams).promise();
//                 console.log('New weekly JSON file created and uploaded to S3:', fileName);
//             } else {
//                 // Handle other errors
//                 console.error('Error fetching existing weekly JSON from S3:', getError);
//                 return;
//             }
//         }

//         // Delete the uploaded data from MongoDB
//         const deleteResult = await difference.deleteMany({ timestamp: { $gte: startOfWeek, $lte: now } });
//         console.log(`Deleted ${deleteResult.deletedCount} records from MongoDB for the past week.`);
//     } catch (error) {
//         console.error('Error in uploading weekly data to S3 and clearing DB:', error);
//     }
// };

// // Schedule the job to run weekly on Sunday at midnight
// const setupWeeklyCronJobS3Difference = () => {
//     cron.schedule('0 0 * * 0', () => {
//         console.log('Running weekly data upload and cleanup...');
//         uploadWeeklyDataToS3AndClearDB();
//     });
// };

// module.exports = { uploadWeeklyDataToS3AndClearDB, setupWeeklyCronJobS3Difference };
