const AWS = require('aws-sdk');
const moment = require("moment-timezone");
const cron = require('node-cron');
const DifferenceData = require('../models/differeneceData'); // Keep only one reference
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
        const bucketName = 'ems-ebhoom-bucket'; // Your S3 bucket
        const fileKey = 'hourly_data/hourlyData.json'; // Path to hourly data JSON file

        console.log('Fetching hourly data from S3...');
        const params = { Bucket: bucketName, Key: fileKey };

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

                // ✅ Save the first incoming value of the day as `initialFlow`
                if (!groupedData[key].initial || moment(entry.timestamp).isBefore(groupedData[key].initial.timestamp)) {
                    groupedData[key].initial = { ...stack, timestamp: entry.timestamp };
                }

                // ✅ Save the last available value as `lastFlow` (if before 11:45 PM, default to 0)
                if (!groupedData[key].last || moment(entry.timestamp).isAfter(groupedData[key].last.timestamp)) {
                    groupedData[key].last = { ...stack, timestamp: entry.timestamp };
                }
            }
        }

        // ✅ **Calculate Differences & Store Initial Data Even Before 11:45 PM**
        for (const key in groupedData) {
            const { userName, stackName, stationType, initial, last } = groupedData[key];

            if (initial) {
                console.log(`\n💾 [${userName} - ${stackName}] Initial Data:`, initial);
                console.log(`💾 [${userName} - ${stackName}] Last Data:`, last);

                // ✅ Before 11:45 PM: `lastCumulatingFlow` will be `0`, ensuring initial data is available
                // ✅ After 11:45 PM: The correct `lastCumulatingFlow` will be stored
                const result = {
                    userName,
                    stackName,
                    stationType,
                    date: today,
                    initialEnergy: initial.energy || 0,
                    lastEnergy: last?.energy || 0,
                    energyDifference: (last?.energy || 0) - (initial.energy || 0),
                    initialCumulatingFlow: initial.cumulatingFlow || 0,
                    lastCumulatingFlow: last?.cumulatingFlow || 0,
                    cumulatingFlowDifference: (last?.cumulatingFlow || 0) - (initial.cumulatingFlow || 0),
                    time: moment().format('HH:mm:ss'),
                    intervalType: 'day',
                    interval: "daily"
                };

                // ✅ Ensure `lastCumulatingFlow` is **0** before 11:45 PM
                if (!moment().tz('Asia/Kolkata').isSame(moment().set({ hour: 23, minute: 45 }), 'minute')) {
                    result.lastCumulatingFlow = 0;
                    result.cumulatingFlowDifference = 0;
                }

                results.push(result);
                console.log('✅ Calculated result:', result);
            }
        }

        // ✅ Save results to the database
        if (results.length > 0) {
            await DifferenceData.insertMany(results);
            console.log('📦 Daily differences saved successfully.');
        } else {
            console.log('⚠️ No results to save.');
        }
    } catch (error) {
        console.error('❌ Error calculating daily differences from S3:', error);
    }
};





// const scheduleDifferenceCalculation = () => {
//     cron.schedule('0 0 * * *', async () => {
//         console.log('Running daily difference calculation...');
//         await calculateDailyDifference();
//     });

//     console.log('Daily difference calculation scheduled at midnight.');
// };

// const scheduleDifferenceCalculation = () => {
//     cron.schedule('0 * * * *', async () => { // Runs every 5 minutes
//         console.log('Running difference calculation every 5 minutes...');
//         await calculateDailyDifferenceFromS3();
//     });

//     console.log('Difference calculation scheduled to run every 5 minutes.');
// };
const scheduleDifferenceCalculation = () => {

    cron.schedule('45 23 * * *', async () => { // Runs at 11:45 PM every night
        console.log('Running difference calculation at 11:45 PM...');
        await calculateDailyDifferenceFromS3();
    });

    console.log('Difference calculation scheduled to run at 11:45 PM every night.');
};



// Controller to fetch difference data by userName and interval
// Controller to fetch difference data by userName and interval with pagination
const getDifferenceDataByUserNameAndInterval = async (userName, interval, page = 1, limit = 50) => {
    try {
        const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format

        // Fetch all data from MongoDB
        let dbData = await DifferenceData.find({ userName, interval })
            .select('userName interval stackName date time initialEnergy lastEnergy energyDifference initialCumulatingFlow lastCumulatingFlow cumulatingFlowDifference initialFlowRate lastFlowRate flowRateDifference timestamp')
            .lean();

        // Fetch data from S3
        const bucketName = 'ems-ebhoom-bucket';
        const s3Key = 'difference_data/hourlyDifferenceData.json';

        let s3Data = [];
        try {
            const s3Object = await s3.getObject({ Bucket: bucketName, Key: s3Key }).promise();
            const fileData = JSON.parse(s3Object.Body.toString('utf-8'));

            // Filter S3 data based on userName and interval
            s3Data = fileData.filter(entry => entry.userName === userName && entry.interval === interval);
        } catch (err) {
            if (err.code !== 'NoSuchKey') throw err; // Ignore missing file errors
        }

        // Combine MongoDB and S3 data
        let combinedData = [...dbData, ...s3Data];

        // **Ensure Today's Data is Moved to the Top**
        let todayData = combinedData.filter(entry => entry.date === today);
        let pastData = combinedData.filter(entry => entry.date !== today);

        // **Sort past data in descending order (latest first)**
        pastData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // **Final Sorted Data**
        let sortedData = [...todayData, ...pastData];

        // **Apply Pagination AFTER Sorting**
        const total = sortedData.length;
        const paginatedData = sortedData.slice((page - 1) * limit, page * limit);

        return {
            data: paginatedData,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    } catch (error) {
        console.error('Error fetching data by userName and interval:', error);
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

        // Fetch data from MongoDB
        const dbData = await DifferenceData.find({
            userName,
            interval,
            timestamp: { $gte: startUTC, $lte: endUTC },
        })
            .select('userName interval stackName date time initialEnergy lastEnergy energyDifference timestamp')
            .sort({ timestamp: -1 })
            .lean();

        // Fetch data from S3
        const bucketName = 'ems-ebhoom-bucket'; // Replace with your bucket name
        const s3Key = 'difference_data/hourlyDifferenceData.json'; // Path to S3 file

        let s3Data = [];
        try {
            const s3Object = await s3.getObject({ Bucket: bucketName, Key: s3Key }).promise();
            const fileData = JSON.parse(s3Object.Body.toString('utf-8'));

            // Filter data based on userName, interval, and timestamp range
            s3Data = fileData.filter(entry => {
                const entryDate = moment(entry.date, 'DD/MM/YYYY').utc().toDate();
                return entry.userName === userName && entry.interval === interval &&
                    entryDate >= startUTC && entryDate <= endUTC;
            });
        } catch (err) {
            if (err.code !== 'NoSuchKey') throw err; // If the file doesn't exist, ignore; otherwise, rethrow
        }

        // Combine MongoDB and S3 data
        const combinedData = [...dbData, ...s3Data];
        const total = combinedData.length;

        // Paginate combined data
        const paginatedData = combinedData.slice(skip, skip + limit);

        return {
            data: paginatedData,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    } catch (error) {
        console.error('Error fetching data by time range:', error);
        throw error;
    }
};

// get the data using the userName interval fromDate toDate last data of every day mentioned
const getLastDataByDateRange = async (userName, interval, fromDate, toDate) => {
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

        // Fetch distinct dates within the range from MongoDB
        const dbData = await DifferenceData.aggregate([
            {
                $match: {
                    userName,
                    interval,
                    timestamp: { $gte: startUTC, $lte: endUTC },
                },
            },
            {
                $addFields: {
                    dateOnly: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
                },
            },
            {
                $group: {
                    _id: '$dateOnly',
                    lastEntry: { $last: '$$ROOT' },
                },
            },
            {
                $sort: { _id: 1 },
            },
        ]);

        // Fetch data from S3 bucket
        const bucketName = 'ems-ebhoom-bucket'; // Replace with your bucket name
        const fileKey = 'difference_data/hourlyDifferenceData.json'; // Path to the S3 file
        let s3Data = [];

        try {
            console.log('Fetching data from S3...');
            const s3Object = await s3.getObject({
                Bucket: bucketName,
                Key: fileKey,
            }).promise();
            const s3FileData = JSON.parse(s3Object.Body.toString('utf-8'));

            s3Data = s3FileData.filter(entry => {
                const entryDate = moment(entry.date, 'DD/MM/YYYY').utc().toDate();
                return entry.userName === userName && entryDate >= startUTC && entryDate <= endUTC;
            });
        } catch (s3Error) {
            if (s3Error.code === 'NoSuchKey') {
                console.warn('No data file found in S3 bucket.');
            } else {
                console.error('Error fetching data from S3:', s3Error.message);
            }
        }

        // Process S3 data to get the last entry for each day
        const s3GroupedData = s3Data.reduce((acc, entry) => {
            const dateOnly = moment(entry.timestamp).format('YYYY-MM-DD');
            if (!acc[dateOnly] || moment(entry.timestamp).isAfter(acc[dateOnly].timestamp)) {
                acc[dateOnly] = entry;
            }
            return acc;
        }, {});

        const s3LastEntries = Object.values(s3GroupedData);

        // Combine MongoDB and S3 data
        const combinedData = [...dbData.map(entry => entry.lastEntry), ...s3LastEntries];

        if (combinedData.length === 0) {
            throw new Error('No data found for the specified criteria.');
        }

        return {
            success: true,
            message: `Last data for each date fetched successfully.`,
            data: combinedData,
        };
    } catch (error) {
        console.error('Error fetching last data by date range:', error);
        throw error;
    }
};

const getTodayDifferenceData = async (req, res) => {
    try {
        const { userName } = req.query;

        if (!userName) {
            return res.status(400).json({ success: false, message: 'userName is required.' });
        }

        // Get today's date in IST and convert to UTC range
        const todayStartIST = moment().tz('Asia/Kolkata').startOf('day');
        const todayEndIST = moment().tz('Asia/Kolkata').endOf('day');

        const todayStartUTC = todayStartIST.utc().toDate();
        const todayEndUTC = todayEndIST.utc().toDate();

        // Fetch today's data from the database
        const dbData = await DifferenceData.find({
            userName,
            timestamp: { $gte: todayStartUTC, $lte: todayEndUTC },
        })
            .select('userName interval stackName date time initialEnergy lastEnergy energyDifference initialCumulatingFlow lastCumulatingFlow cumulatingFlowDifference timestamp')
            .sort({ timestamp: -1 })
            .lean();

        // Fetch data from S3 bucket
        const bucketName = 'ems-ebhoom-bucket'; // Replace with your bucket name
        const fileKey = 'difference_data/hourlyDifferenceData.json'; // Replace with your S3 key
        const params = {
            Bucket: bucketName,
            Key: fileKey,
        };

        let s3Data = [];
        try {
            console.log('Fetching hourly data from S3...');
            const s3Object = await s3.getObject(params).promise();
            const s3FileData = JSON.parse(s3Object.Body.toString('utf-8'));

            // Filter S3 data for today and the given userName
            s3Data = s3FileData.filter(entry => {
                const entryDate = moment(entry.date, 'DD/MM/YYYY').utc().toDate();
                return entry.userName === userName && entryDate >= todayStartUTC && entryDate <= todayEndUTC;
            });
        } catch (s3Error) {
            if (s3Error.code === 'NoSuchKey') {
                console.warn('No data file found in S3 bucket for the given key.');
            } else {
                console.error('Error fetching data from S3:', s3Error.message);
            }
        }

        // Combine database and S3 data
        const combinedData = [...dbData, ...s3Data];

        if (combinedData.length === 0) {
            return res.status(404).json({
                success: false,
                message: `No difference data found for ${userName} today.`,
            });
        }

        res.status(200).json({
            success: true,
            message: `Today's combined difference data for ${userName} fetched successfully.`,
            data: combinedData,
        });
    } catch (error) {
        console.error('Error fetching today\'s combined difference data:', error);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error',
            error: error.message,
        });
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


//get yesterdays difference data 

const getYesterdayDifferenceData = async (userName) => {
    try {
        // 🔹 Get Yesterday's Date in IST
        const yesterdayIST = moment().tz("Asia/Kolkata").subtract(1, "day");
        const formattedYesterdayDate = yesterdayIST.format("DD/MM/YYYY");

        // 🔹 Convert to UTC for MongoDB Query
        const yesterdayStartUTC = yesterdayIST.startOf("day").utc().toDate();
        const yesterdayEndUTC = yesterdayIST.endOf("day").utc().toDate();

        console.log(`Fetching data for user: ${userName}`);
        console.log(`Yesterday UTC Start: ${yesterdayStartUTC}, End: ${yesterdayEndUTC}`);
        console.log(`Formatted Yesterday Date (DD/MM/YYYY): ${formattedYesterdayDate}`);

        // ✅ **Step 1: Fetch Data from MongoDB**
        const dbData = await DifferenceData.find({
            userName,
            $or: [
                { timestamp: { $gte: yesterdayStartUTC, $lte: yesterdayEndUTC } },
                { date: formattedYesterdayDate },
            ],
        })
        .select("userName stackName date timestamp initialEnergy lastEnergy energyDifference initialCumulatingFlow lastCumulatingFlow cumulatingFlowDifference")
        .sort({ timestamp: -1 })
        .lean();

        const filteredDbData = dbData.filter(entry => entry.date === formattedYesterdayDate);
        console.log(`Filtered Database Data Found: ${filteredDbData.length}`);

        if (filteredDbData.length === 0) {
            console.warn(`⚠ No database records found for ${userName} on ${formattedYesterdayDate}`);
        }

        // ✅ **Step 2: Fetch Data from S3**
        const bucketName = "ems-ebhoom-bucket";
        const fileKey = "difference_data/hourlyDifferenceData.json";
        let s3Data = [];

        try {
            console.log("Fetching hourly data from S3...");
            const s3Object = await s3.getObject({ Bucket: bucketName, Key: fileKey }).promise();
            const s3FileData = JSON.parse(s3Object.Body.toString("utf-8"));

            console.log(`Total records in S3 file: ${s3FileData.length}`);

            // 🔹 Filter S3 Data for Yesterday
            s3Data = s3FileData.filter(entry => entry.userName === userName && entry.date === formattedYesterdayDate);

            console.log(`Filtered S3 Data Found: ${s3Data.length}`);
        } catch (s3Error) {
            if (s3Error.code === "NoSuchKey") {
                console.warn("⚠ No data file found in S3 bucket for the given key.");
            } else {
                console.error("Error fetching data from S3:", s3Error.message);
            }
        }

        // ✅ **Step 3: Combine Data**
        const combinedData = [...filteredDbData, ...s3Data];

        if (combinedData.length === 0) {
            console.warn(`⚠ No data found for ${userName} on ${formattedYesterdayDate}`);
            return [];  // ✅ **Return empty array instead of throwing an error**
        }

        return combinedData;
    } catch (error) {
        console.error("Error fetching yesterday's difference data:", error);
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

const getEnergyAndFlowDataByDateRange = async (userName, fromDate, toDate) => {
    try {
        const startIST = moment.tz(fromDate, 'DD-MM-YYYY', 'Asia/Kolkata').startOf('day');
        const endIST = moment.tz(toDate, 'DD-MM-YYYY', 'Asia/Kolkata').endOf('day');

        const startUTC = startIST.utc().toDate();
        const endUTC = endIST.utc().toDate();

        if (isNaN(startUTC) || isNaN(endUTC)) {
            throw new Error('Invalid date format. Use "DD-MM-YYYY".');
        }

        // Fetch data from MongoDB
        const dbData = await DifferenceData.find({
            userName,
            timestamp: { $gte: startUTC, $lte: endUTC },
        })
            .select('userName stackName date time initialEnergy lastEnergy initialCumulatingFlow lastCumulatingFlow timestamp')
            .sort({ timestamp: -1 })
            .lean();

        // Fetch data from S3 bucket
        const bucketName = 'ems-ebhoom-bucket'; // Replace with your bucket name
        const fileKey = 'difference_data/hourlyDifferenceData.json'; // Replace with your S3 key
        const params = {
            Bucket: bucketName,
            Key: fileKey,
        };

        let s3Data = [];
        try {
            console.log('Fetching hourly data from S3...');
            const s3Object = await s3.getObject(params).promise();
            const s3FileData = JSON.parse(s3Object.Body.toString('utf-8'));

            // Filter S3 data for the given userName and date range
            s3Data = s3FileData.filter(entry => {
                const entryDate = moment(entry.date, 'DD/MM/YYYY').utc().toDate();
                return entry.userName === userName && entryDate >= startUTC && entryDate <= endUTC;
            });
        } catch (s3Error) {
            if (s3Error.code === 'NoSuchKey') {
                console.warn('No data file found in S3 bucket for the given key.');
            } else {
                console.error('Error fetching data from S3:', s3Error.message);
            }
        }

        // Combine database and S3 data
        const combinedData = [...dbData, ...s3Data];

        if (combinedData.length === 0) {
            throw new Error('No data found for the specified criteria.');
        }

        return {
            success: true,
            message: `Energy and flow data for ${userName} fetched successfully.`,
            data: combinedData,
        };
    } catch (error) {
        console.error('Error fetching energy and flow data by date range:', error);
        throw error;
    }
};


const getLastCumulativeFlowOfLastMonth = async (req, res) => {
    try {
        const { userName, stackName } = req.params;

        if (!userName || !stackName) {
            return res.status(400).json({
                success: false,
                message: "userName and stackName are required.",
            });
        }

        // Get last month dynamically
        const today = moment().tz("Asia/Kolkata");
        const lastMonth = today.subtract(1, "month");
        const lastMonthYear = lastMonth.year();
        const lastMonthNumber = lastMonth.month() + 1; // Month is 0-indexed in Moment.js

        // Fetch stack data for the user from MongoDB for the previous month
        const lastEntries = await DifferenceData.find({
            userName,
            stackName,
            date: new RegExp(`/${lastMonthNumber}/${lastMonthYear}$`), // Matches any day in last month
        })
        .sort({ timestamp: -1 }) // Get latest entries first
        .select("userName stackName lastCumulatingFlow date timestamp")
        .lean();

        if (lastEntries.length > 0) {
            return res.status(200).json({
                success: true,
                message: `Last cumulative flow for ${stackName} of ${userName} in ${lastMonthNumber}/${lastMonthYear} fetched successfully from MongoDB.`,
                data: lastEntries,
            });
        }

        // If no data in MongoDB, fetch from S3
        console.log("Fetching last month data from S3...");
        const bucketName = "ems-ebhoom-bucket"; // Your S3 bucket name
        const fileKey = "difference_data/hourlyDifferenceData.json"; // Your S3 file path

        const params = {
            Bucket: bucketName,
            Key: fileKey,
        };

        let s3Data = [];
        try {
            const s3Object = await s3.getObject(params).promise();
            const s3FileData = JSON.parse(s3Object.Body.toString("utf-8"));

            // Filter data for the user, stack, and previous month
            s3Data = s3FileData.filter(entry => {
                const entryDate = moment(entry.date, "DD/MM/YYYY").tz("Asia/Kolkata");
                return entry.userName === userName && entry.stackName === stackName && entryDate.month() + 1 === lastMonthNumber && entryDate.year() === lastMonthYear;
            });

            if (s3Data.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: `No data found for ${stackName} of ${userName} in S3 for ${lastMonthNumber}/${lastMonthYear}.`,
                });
            }

            // Get the latest entry for the stack
            const latestEntry = s3Data.reduce((latest, entry) => {
                return moment(entry.timestamp).isAfter(moment(latest.timestamp)) ? entry : latest;
            }, s3Data[0]);

            return res.status(200).json({
                success: true,
                message: `Last cumulative flow for ${stackName} of ${userName} in ${lastMonthNumber}/${lastMonthYear} fetched successfully from S3.`,
                data: latestEntry,
            });
        } catch (s3Error) {
            if (s3Error.code === "NoSuchKey") {
                console.warn("⚠ No data file found in S3.");
            } else {
                console.error("❌ Error fetching data from S3:", s3Error.message);
            }

            return res.status(500).json({
                success: false,
                message: "Error fetching data from S3.",
                error: s3Error.message,
            });
        }
    } catch (error) {
        console.error("❌ Error fetching last cumulative flow of last month:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message,
        });
    }
};
const getLastCumulativeFlowForUser = async (req, res) => {
    try {
        const { userName } = req.params;

        if (!userName) {
            return res.status(400).json({
                success: false,
                message: "userName is required.",
            });
        }

        // Get last month dynamically
        const today = moment().tz("Asia/Kolkata");
        const lastMonth = today.subtract(1, "month");
        const lastMonthYear = lastMonth.year();
        const lastMonthNumber = lastMonth.month() + 1; // Month is 0-indexed in Moment.js

        // Fetch data for the user from MongoDB for the previous month
        const lastEntries = await DifferenceData.find({
            userName,
            date: new RegExp(`/${lastMonthNumber}/${lastMonthYear}$`), // Matches any day in last month
        })
        .sort({ timestamp: -1 }) // Get latest entries first
        .select("userName stackName lastCumulatingFlow date timestamp")
        .lean();

        if (lastEntries.length > 0) {
            return res.status(200).json({
                success: true,
                message: `Last cumulative flow for ${userName} in ${lastMonthNumber}/${lastMonthYear} fetched successfully from MongoDB.`,
                data: lastEntries,
            });
        }

        // If no data in MongoDB, fetch from S3
        console.log("Fetching last month data from S3...");
        const bucketName = "ems-ebhoom-bucket"; // Your S3 bucket name
        const fileKey = "difference_data/hourlyDifferenceData.json"; // Your S3 file path

        const params = {
            Bucket: bucketName,
            Key: fileKey,
        };

        let s3Data = [];
        try {
            const s3Object = await s3.getObject(params).promise();
            const s3FileData = JSON.parse(s3Object.Body.toString("utf-8"));

            // Filter data for the user and previous month
            s3Data = s3FileData.filter(entry => {
                const entryDate = moment(entry.date, "DD/MM/YYYY").tz("Asia/Kolkata");
                return entry.userName === userName && entryDate.month() + 1 === lastMonthNumber && entryDate.year() === lastMonthYear;
            });

            if (s3Data.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: `No data found for ${userName} in S3 for ${lastMonthNumber}/${lastMonthYear}.`,
                });
            }

            // Get the latest entry for each stack
            const latestEntries = {};
            s3Data.forEach(entry => {
                if (!latestEntries[entry.stackName] || moment(entry.timestamp).isAfter(moment(latestEntries[entry.stackName].timestamp))) {
                    latestEntries[entry.stackName] = entry;
                }
            });

            return res.status(200).json({
                success: true,
                message: `Last cumulative flow for ${userName} in ${lastMonthNumber}/${lastMonthYear} fetched successfully from S3.`,
                data: Object.values(latestEntries),
            });
        } catch (s3Error) {
            if (s3Error.code === "NoSuchKey") {
                console.warn("⚠ No data file found in S3.");
            } else {
                console.error("❌ Error fetching data from S3:", s3Error.message);
            }

            return res.status(500).json({
                success: false,
                message: "Error fetching data from S3.",
                error: s3Error.message,
            });
        }
    } catch (error) {
        console.error("❌ Error fetching last cumulative flow of last month:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message,
        });
    }
};


module.exports = {
    getDifferenceDataByUserNameAndInterval,
    getAllDifferenceDataByUserName,
    getDifferenceDataByTimeRange,
    downloadDifferenceData,
    scheduleDifferenceCalculation,
    getLastDataByDateRange,
    getTodayDifferenceData,
    getEnergyAndFlowDataByDateRange,
    getYesterdayDifferenceData ,
    getLastCumulativeFlowOfLastMonth ,
    getLastCumulativeFlowForUser
};

