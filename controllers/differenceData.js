const IotData = require('../models/iotData');
const DifferenceData = require('../models/differeneceData'); // Ensure correct spelling of 'differenceData'
const cron = require('node-cron');
const { Parser } = require('json2csv'); // For CSV export
const PDFDocument = require('pdfkit');
const moment = require('moment-timezone');


// Helper to fetch initial and last entries for a stack
const getInitialAndLastEntries = async (userName, stackName, startTime, endTime) => {
    const data = await IotData.find({
        userName,
        'stackData.stackName': stackName,
        timestamp: { $gte: startTime, $lte: endTime },
    }).sort({ timestamp: 1 });

    if (!data.length) return null;

    return { initialEntry: data[0], lastEntry: data[data.length - 1] };
};

// Extract values from stack data
const extractValues = (entry, stackName) => {
    const stack = entry.stackData.find(stack => stack.stackName === stackName) || {};
    const timestamp = moment(entry.timestamp);

    return {
        energy: stack.energy || 0,
        inflow: stack.inflow || 0,
        finalflow: stack.finalflow || 0,
        date: timestamp.format('DD/MM/YYYY'),
        time: timestamp.format('HH:mm'),
    };
};

// Calculate and save the difference data
const calculateAndSaveDifferences = async (userName, stackName, stationType, interval, intervalType, startTime, endTime) => {
    const entries = await getInitialAndLastEntries(userName, stackName, startTime, endTime);
    if (!entries) return;

    const { initialEntry, lastEntry } = entries;
    const initialValues = extractValues(initialEntry, stackName);
    const lastValues = extractValues(lastEntry, stackName);

    const differenceDataEntry = {
        stackName,
        stationType: stationType || 'NIL',
        initialEnergy: initialValues.energy,
        lastEnergy: lastValues.energy,
        energyDifference: lastValues.energy - initialValues.energy,
        initialInflow: initialValues.inflow,
        lastInflow: lastValues.inflow,
        inflowDifference: lastValues.inflow - initialValues.inflow,
        initialFinalFlow: initialValues.finalflow,
        lastFinalFlow: lastValues.finalflow,
        finalFlowDifference: lastValues.finalflow - initialValues.finalflow,
    };

    // Convert to IST and format the interval
    const intervalIST = moment().tz('Asia/Kolkata').format('ddd MMM DD YYYY HH:mm:ss [GMT+0530] (India Standard Time)');

    const differenceEntry = new DifferenceData({
        userName,
        interval: intervalIST,
        intervalType,
        date: initialValues.date,
        time: initialValues.time,
        differenceData: [differenceDataEntry], // Save the difference in an array
        timestamp: new Date(),
    });

    await differenceEntry.save();
    console.log(`Saved difference data for ${userName} - ${stackName}`);
};

// Schedule the difference calculations
const scheduleDifferenceCalculation = () => {
    const intervals = [
        { cronTime: '0 * * * *', interval: 'hourly', intervalType: 'hour' }, // Every hour
        { cronTime: '0 0 * * *', interval: 'daily', intervalType: 'day' }, // Every day
    ];

    intervals.forEach(({ cronTime, interval, intervalType }) => {
        cron.schedule(cronTime, async () => {
            console.log(`Running ${interval} difference calculation...`);
            const users = await IotData.distinct('userName');

            for (const userName of users) {
                const stackNames = await IotData.aggregate([
                    { $match: { userName } },
                    { $unwind: '$stackData' },
                    { $group: { _id: '$stackData.stackName' } },
                ]).then(result => result.map(item => item._id));

                for (const stackName of stackNames) {
                    const now = new Date();
                    const startTime = new Date(now.getTime() - (intervalType === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000));
                    const stationType = await IotData.findOne({ userName, 'stackData.stackName': stackName }).select('stackData.stationType');

                    await calculateAndSaveDifferences(
                        userName,
                        stackName,
                        stationType?.stackData?.stationType,
                        interval,
                        intervalType,
                        startTime,
                        now
                    );
                }
            }
        });
    });
};



// Controller to fetch difference data by userName and interval
// Controller to fetch difference data by userName and interval with pagination
const getDifferenceDataByUserNameAndInterval = async (userName, interval, page = 1, limit = 10) => {
    try {
        if (!['daily', 'hourly'].includes(interval)) {
            throw new Error('Invalid interval. Use "daily" or "hourly".');
        }

        const skip = (page - 1) * limit;

        // Query MongoDB to fetch relevant fields, including stackName and energy-related fields
        const data = await DifferenceData.find({ userName, interval })
            .select('userName interval stackName date time initialEnergy lastEnergy energyDifference timestamp initialInflow lastInflow inflowDifference initialFinalFlow lastFinalFlow finalFlowDifference')
            .sort({ timestamp: -1 }) // Sort by most recent timestamp
            .skip(skip)
            .limit(limit)
            .lean(); // Converts Mongoose documents to plain objects

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

            const csvData = data.map(item => ({
                userName: item.userName,
                interval: item.interval,
                date: item.date,
                time: item.time,
                stackName: item.stackName,
                initialEnergy: item.initialEnergy,
                lastEnergy: item.lastEnergy,
                energyDifference: item.energyDifference,
                initialInflow: item.initialInflow,
                lastInflow: item.lastInflow,
                inflowDifference: item.inflowDifference,
                initialFinalFlow: item.initialFinalFlow,
                lastFinalFlow: item.lastFinalFlow,
                finalFlowDifference: item.finalFlowDifference,
            }));

            const parser = new Parser({ fields });
            const csv = parser.parse(csvData);

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

