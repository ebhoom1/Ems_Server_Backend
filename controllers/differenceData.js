const AWS = require('aws-sdk');
const moment = require('moment');
const cron = require('node-cron');
const DailyDifference = require('../models/differeneceData');
const DifferenceData = require('../models/differeneceData');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit'); 


AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

const calculateDailyDifferenceFromS3 = async () => {
    try {
        const bucketName = 'ems-ebhoom-bucket'; // Replace with your bucket name
        const fileKey = 'hourly_data/hourlyData.json'; // Path to the hourly data JSON file

        console.log('Fetching hourly data from S3...');
        const params = {
            Bucket: bucketName,
            Key: fileKey,
        };

        const s3Object = await s3.getObject(params).promise();
        const hourlyData = JSON.parse(s3Object.Body.toString('utf-8'));

        const today = moment().startOf('day').format('DD/MM/YYYY');
        console.log('Calculating daily differences for date:', today);

        const filteredData = hourlyData.filter(entry => entry.date === today);

        if (filteredData.length === 0) {
            console.log('No hourly data found for today in S3.');
            return;
        }

        console.log(`Hourly data found for today: ${filteredData.length} records`);

        const results = [];

        // Group data by user and stack
        const groupedData = {};
        for (const entry of filteredData) {
            for (const stack of entry.stacks) {
                const key = `${entry.userName}_${stack.stackName}`;
                if (!groupedData[key]) {
                    groupedData[key] = {
                        userName: entry.userName,
                        stackName: stack.stackName,
                        stationType: stack.stationType,
                        initial: null,
                        last: null,
                    };
                }

                // Assign initial and last values
                if (!groupedData[key].initial || moment(entry.timestamp).isBefore(groupedData[key].initial.timestamp)) {
                    groupedData[key].initial = { ...stack, timestamp: entry.timestamp };
                }
                if (!groupedData[key].last || moment(entry.timestamp).isAfter(groupedData[key].last.timestamp)) {
                    groupedData[key].last = { ...stack, timestamp: entry.timestamp };
                }
            }
        }

        // Calculate differences
        for (const key in groupedData) {
            const { userName, stackName, stationType, initial, last } = groupedData[key];

            if (initial && last) {
                const result = {
                    userName,
                    stackName,
                    stationType,
                    date: today,
                    initialEnergy: initial.energy || 0,
                    lastEnergy: last.energy || 0,
                    energyDifference: (last.energy || 0) - (initial.energy || 0),
                    initialCumulatingFlow: initial.cumulatingFlow || 0,
                    lastCumulatingFlow: last.cumulatingFlow || 0,
                    cumulatingFlowDifference: (last.cumulatingFlow || 0) - (initial.cumulatingFlow || 0),
                    time: moment().format('HH:mm:ss'),
                    intervalType:'day',
                    interval:"daily"
                };

                results.push(result);
                console.log('Calculated result:', result);
            }
        }

        // Save results to the database
        if (results.length > 0) {
            await DifferenceData.insertMany(results);
            console.log('Daily differences saved successfully.');
        } else {
            console.log('No results to save.');
        }
    } catch (error) {
        console.error('Error calculating daily differences from S3:', error);
    }
};



// const scheduleDifferenceCalculation = () => {
//     cron.schedule('0 0 * * *', async () => {
//         console.log('Running daily difference calculation...');
//         await calculateDailyDifference();
//     });

//     console.log('Daily difference calculation scheduled at midnight.');
// };

const scheduleDifferenceCalculation = () => {
    cron.schedule('0 * * * *', async () => { // Runs every 5 minutes
        console.log('Running difference calculation every 5 minutes...');
        await calculateDailyDifferenceFromS3();
    });

    console.log('Difference calculation scheduled to run every 5 minutes.');
};




// Controller to fetch difference data by userName and interval
// Controller to fetch difference data by userName and interval with pagination
const getDifferenceDataByUserNameAndInterval = async (userName, interval, page = 1, limit = 10) => {
    try {
        const skip = (page - 1) * limit;

        const data = await DifferenceData.find({ userName, interval })
            .select('userName interval stackName date time initialEnergy lastEnergy energyDifference initialCumulatingFlow lastCumulatingFlow cumulatingFlowDifference initialFlowRate lastFlowRate flowRateDifference timestamp')
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await DifferenceData.countDocuments({ userName, interval });

        return {
            data,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    } catch (error) {
        console.error('Error fetching difference data:', error);
        throw error;
    }
};

// Controller to fetch data by userName and time range with projections and limit
// Controller to fetch data by userName and time range with pagination
const getDifferenceDataByTimeRange = async (userName, interval, fromDate, toDate, page = 1, limit = 10) => {
    try {
        if (!['daily', 'hourly'].includes(interval)) {
            throw new Error('Invalid interval. Use "daily" or "hourly".');
        }

        const startIST = moment.tz(fromDate, 'DD-MM-YYYY', 'Asia/Kolkata').startOf('day');
        const endIST = moment.tz(toDate, 'DD-MM-YYYY', 'Asia/Kolkata').endOf('day');

        const startUTC = startIST.utc().toDate();
        const endUTC = endIST.utc().toDate();

        if (isNaN(startUTC) || isNaN(endUTC)) {
            throw new Error('Invalid date format. Use "DD-MM-YYYY".');
        }

        const skip = (page - 1) * limit;

        const data = await DifferenceData.find({
            userName,
            interval,
            timestamp: { $gte: startUTC, $lte: endUTC },
        })
            .select('userName interval stackName date time initialEnergy lastEnergy energyDifference timestamp')
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await DifferenceData.countDocuments({
            userName,
            interval,
            timestamp: { $gte: startUTC, $lte: endUTC },
        });

        return {
            data,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    } catch (error) {
        console.error('Error fetching data by time range:', error);
        throw error;
    }
};

// Controller to fetch both hourly and daily difference data by userName
// Controller to fetch all difference data by userName with pagination and interval filtering
const getAllDifferenceDataByUserName = async (userName, interval, page = 1, limit = 10) => {
    try {
        if (!['daily', 'hourly'].includes(interval)) {
            throw new Error('Invalid interval. Use "daily" or "hourly".');
        }

        const skip = (page - 1) * limit;

        const data = await DifferenceData.find({ userName, interval })
            .select('userName interval stackName date time initialEnergy lastEnergy energyDifference timestamp')
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await DifferenceData.countDocuments({ userName, interval });

        return {
            data,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    } catch (error) {
        console.error('Error fetching all difference data:', error);
        throw error;
    }
};





// Function to download data as CSV

// Unified function to download difference data as CSV or PDF
const downloadDifferenceData = async (req, res) => {
    try {
        const { userName, fromDate, toDate, format, intervalType = 'daily' } = req.query;

        console.log('Query Parameters:', req.query);

        if (!userName || !fromDate || !toDate || !format) {
            return res.status(400).json({ success: false, message: 'Missing required query parameters.' });
        }

        const parsedFromDate = moment.tz(fromDate, 'DD-MM-YYYY', 'Asia/Kolkata').startOf('day').toDate();
        const parsedToDate = moment.tz(toDate, 'DD-MM-YYYY', 'Asia/Kolkata').endOf('day').toDate();

        if (isNaN(parsedFromDate) || isNaN(parsedToDate)) {
            return res.status(400).json({ success: false, message: 'Invalid date format. Use "DD-MM-YYYY".' });
        }

        // Query the data using userName, interval type, and timestamp range
        const data = await DifferenceData.find({
            userName: decodeURIComponent(userName.trim()),
            interval: intervalType,
            timestamp: { $gte: parsedFromDate, $lte: parsedToDate },
        }).lean();

        if (!data.length) {
            return res.status(404).json({ success: false, message: 'No data found for the specified criteria.' });
        }

        if (format === 'csv') {
            const fields = [
                'userName', 'interval', 'date', 'time', 'stackName',
                'initialEnergy', 'lastEnergy', 'energyDifference',
                'initialInflow', 'lastInflow', 'inflowDifference',
                'initialFinalFlow', 'lastFinalFlow', 'finalFlowDifference',
            ];

            const csvParser = new Parser({ fields });
            const csv = csvParser.parse(data);

            res.header('Content-Type', 'text/csv');
            res.attachment(`${userName}_difference_data.csv`);
            return res.send(csv);
        } else if (format === 'pdf') {
            const doc = new PDFDocument();
            res.header('Content-Type', 'application/pdf');
            res.attachment(`${userName}_difference_data.pdf`);

            doc.pipe(res);
            doc.fontSize(20).text('Difference Data Report', { align: 'center' });
            doc.fontSize(12).text(`User Name: ${userName}`);
            doc.fontSize(12).text(`Date Range: ${fromDate} - ${toDate}`);
            doc.fontSize(12).text(`Interval Type: ${intervalType}`);
            doc.moveDown();

            data.forEach(item => {
                doc.fontSize(10).text(`Date: ${item.date}, Time: ${item.time}, Stack: ${item.stackName}`);
                doc.text(`Initial Energy: ${item.initialEnergy}, Last Energy: ${item.lastEnergy}, Energy Difference: ${item.energyDifference}`);
                doc.text(`Initial Inflow: ${item.initialInflow}, Last Inflow: ${item.lastInflow}, Inflow Difference: ${item.inflowDifference}`);
                doc.text(`Initial Final Flow: ${item.initialFinalFlow}, Last Final Flow: ${item.lastFinalFlow}, Final Flow Difference: ${item.finalFlowDifference}`);
                doc.moveDown();
            });

            doc.end();
        } else {
            return res.status(400).json({ success: false, message: 'Invalid format requested. Use "csv" or "pdf".' });
        }
    } catch (error) {
        console.error('Error fetching or processing data:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};




module.exports = {
    getDifferenceDataByUserNameAndInterval,
    getAllDifferenceDataByUserName,
    getDifferenceDataByTimeRange,
    downloadDifferenceData,
    scheduleDifferenceCalculation
};

