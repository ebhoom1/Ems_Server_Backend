const AWS = require('aws-sdk');
const moment = require("moment-timezone");
const cron = require('node-cron');
const DifferenceData = require('../models/differeneceData'); // Keep only one reference
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit'); 
const HourlyData = require('../models/hourlyData');

AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

/**
 * Helper: Fetch hourly data from S3; if none found, fallback to MongoDB.
 */
const fetchHourlyData = async (today) => {
    const bucketName = 'ems-ebhoom-bucket';
    const fileKey = 'hourly_data/hourlyData.json';
    let hourlyData = [];
    try {
        console.log('Fetching hourly data from S3...');
        const params = { Bucket: bucketName, Key: fileKey };
        const s3Object = await s3.getObject(params).promise();
        hourlyData = JSON.parse(s3Object.Body.toString('utf-8'));
    } catch (s3Error) {
        console.error('Error fetching data from S3:', s3Error);
    }
    // Filter S3 data for today
    let filteredData = hourlyData.filter(entry => entry.date === today);
    if (filteredData.length === 0) {
        console.log('No hourly data found in S3 for today, checking MongoDB...');
        filteredData = await HourlyData.find({ date: today }).lean();
        if (filteredData.length === 0) {
            console.log('No hourly data found in MongoDB either.');
        }
    }
    return filteredData;
};

// Function to save initial data (upsert into DifferenceData)
const saveInitialData = async () => {
    try {
        const today = moment().startOf('day').format('DD/MM/YYYY');
        const filteredData = await fetchHourlyData(today);
        if (filteredData.length === 0) {
            console.log('No hourly data available for initial capture.');
            return;
        }

        // Group data by userName and stackName to capture the earliest record as initial reading
        const initialRecords = {};
        filteredData.forEach(entry => {
            entry.stacks.forEach(stack => {
                const key = `${entry.userName}_${stack.stackName}`;
                // If not set or this entry's timestamp is earlier, update the record
                if (!initialRecords[key] || moment(entry.timestamp).isBefore(moment(initialRecords[key].timestampRaw))) {
                    initialRecords[key] = {
                        userName: entry.userName,
                        stackName: stack.stackName,
                        stationType: stack.stationType,
                        initialEnergy: stack.energy || 0,
                        initialCumulatingFlow: stack.cumulatingFlow || 0,
                        date: today,
                        interval: 'daily',
                        intervalType: 'day',
                        time: moment().format('HH:mm:ss'),
                        // Store the raw timestamp for comparison
                        timestampRaw: entry.timestamp,
                        // Set current timestamp for record creation/update
                        timestamp: new Date()
                    };
                }
            });
        });

        // Upsert each initial record into DifferenceData (only if not already inserted)
        for (const key in initialRecords) {
            const record = initialRecords[key];
            await DifferenceData.updateOne(
                { userName: record.userName, stackName: record.stackName, date: record.date, interval: 'daily' },
                { $setOnInsert: record },
                { upsert: true }
            );
            console.log(`Initial data saved for ${record.userName} - ${record.stackName}`);
        }
    } catch (error) {
        console.error('Error saving initial data:', error);
    }
};

// Function to calculate final differences and update the existing DifferenceData records
const calculateFinalDifference = async () => {
    try {
        const today = moment().startOf('day').format('DD/MM/YYYY');
        const filteredData = await fetchHourlyData(today);
        if (filteredData.length === 0) {
            console.log('No hourly data available for final calculation.');
            return;
        }

        // Group data by userName and stackName to capture the latest record as final reading
        const finalRecords = {};
        filteredData.forEach(entry => {
            entry.stacks.forEach(stack => {
                const key = `${entry.userName}_${stack.stackName}`;
                if (!finalRecords[key] || moment(entry.timestamp).isAfter(moment(finalRecords[key].timestamp))) {
                    finalRecords[key] = {
                        lastEnergy: stack.energy || 0,
                        lastCumulatingFlow: stack.cumulatingFlow || 0,
                        timestamp: entry.timestamp
                    };
                }
            });
        });

        // For each group, update the corresponding DifferenceData document with final values and differences
        for (const key in finalRecords) {
            const [userName, stackName] = key.split('_');
            const finalRecord = finalRecords[key];
            const existingRecord = await DifferenceData.findOne({ userName, stackName, date: today, interval: 'daily' });
            if (existingRecord) {
                const updatedData = {
                    lastEnergy: finalRecord.lastEnergy,
                    lastCumulatingFlow: finalRecord.lastCumulatingFlow,
                    energyDifference: finalRecord.lastEnergy - existingRecord.initialEnergy,
                    cumulatingFlowDifference: finalRecord.lastCumulatingFlow - existingRecord.initialCumulatingFlow,
                    time: moment().format('HH:mm:ss')
                };

                await DifferenceData.updateOne({ _id: existingRecord._id }, { $set: updatedData });
                console.log(`Final difference updated for ${userName} - ${stackName}:`, updatedData);
            } else {
                console.log(`No initial record found for ${userName} - ${stackName} for ${today}`);
            }
        }
    } catch (error) {
        console.error('Error calculating final difference:', error);
    }
};

// Function to schedule both cron jobs
const scheduleDifferenceCalculation = () => {
    // Schedule initial data capture at 1:05 AM daily
    cron.schedule('5 1 * * *', async () => {
        console.log('Running initial data capture cron job at 1:05 AM...');
        await saveInitialData();
    });
    console.log('Initial data capture scheduled to run at 1:05 AM daily.');

    // Schedule final difference calculation at 11:45 PM daily
    cron.schedule('45 23 * * *', async () => {
        console.log('Running final difference calculation cron job at 11:45 PM...');
        await calculateFinalDifference();
    });
    console.log('Final difference calculation scheduled to run at 11:45 PM daily.');
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
        .select("userName stackName date time timestamp initialEnergy lastEnergy energyDifference initialCumulatingFlow lastCumulatingFlow cumulatingFlowDifference")
        .sort({ timestamp: -1 }) // Sorting by timestamp to get the latest first
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
            return []; // ✅ **Return empty array instead of throwing an error**
        }

        // ✅ **Step 4: Get Only the Last Entered Value for Each stackName**
        const latestEntries = {};
        combinedData.forEach(entry => {
            if (
                !latestEntries[entry.stackName] || 
                new Date(entry.timestamp) > new Date(latestEntries[entry.stackName].timestamp)
            ) {
                latestEntries[entry.stackName] = entry;
            }
        });

        const latestData = Object.values(latestEntries);

        console.log(`Final Filtered Data (Only Last Entered for Each StackName): ${latestData.length}`);
        return latestData;
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
    getLastCumulativeFlowForUser,
    
};


