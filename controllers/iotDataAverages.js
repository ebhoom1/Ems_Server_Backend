const IotData = require('../models/iotData');
const IotDataAverage = require('../models/averageData');
const moment = require('moment-timezone');
const cron = require('node-cron');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');
const AWS = require('aws-sdk');


// Function to calculate averages dynamically
// Function to calculate averages dynamically
// const calculateAverages = async (userName, product_id, startTime, endTime, interval, intervalType) => {
//     console.log(`Calculating averages for ${userName} - ${intervalType}: ${startTime} to ${endTime}`);

//     // Check if an entry already exists for this user, interval, and intervalType
//     const existingRecord = await IotDataAverage.findOne({
//         userName,
//         product_id,
//         interval,
//         intervalType,
//         dateAndTime: moment().format('DD/MM/YYYY HH:mm'),
//     });

//     if (existingRecord) {
//         console.log(`Average entry already exists for ${userName} - ${intervalType}. Skipping save operation.`);
//         return; // Prevent duplicate save
//     }

//     // Aggregation query to fetch data
//     const data = await IotData.aggregate([
//         {
//             $match: {
//                 userName,
//                 product_id,
//                 timestamp: { $gte: new Date(startTime), $lt: new Date(endTime) },
//             },
//         },
//         { $unwind: '$stackData' },
//         {
//             $match: {
//                 'stackData.stackName': { $exists: true, $ne: null },
//             },
//         },
//     ]);

//     console.log(`Extracted ${data.length} entries for ${userName} - ${intervalType}`);
//     if (data.length === 0) return;

//     // Grouping and calculating averages
//     const stackGroups = data.reduce((acc, entry) => {
//         const { stackName, stationType, ...parameters } = entry.stackData;
//         if (!acc[stackName]) acc[stackName] = { stationType, parameters: {} };

//         Object.entries(parameters).forEach(([key, value]) => {
//             acc[stackName].parameters[key] = acc[stackName].parameters[key] || [];
//             acc[stackName].parameters[key].push(parseFloat(value || 0));
//         });

//         return acc;
//     }, {});

//     const stackData = Object.entries(stackGroups).map(([stackName, { stationType, parameters }]) => {
//         const averagedParameters = Object.entries(parameters).reduce((acc, [key, values]) => {
//             const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
//             acc[key] = parseFloat(avg.toFixed(2));
//             return acc;
//         }, {});

//         return {
//             stackName,
//             stationType,
//             parameters: averagedParameters,
//         };
//     });

//     console.log(`Averages for ${userName}:`, stackData);

//     // Prepare and save the new average entry
//     const averageEntry = new IotDataAverage({
//         userName,
//         product_id,
//         interval,
//         intervalType, // Save the interval type
//         dateAndTime: moment().format('DD/MM/YYYY HH:mm'),
//         timestamp: new Date(),
//         stackData,
//     });

//     try {
//         await averageEntry.save();
//         console.log(`Average entry saved for ${userName} - ${intervalType}`);
//     } catch (error) {
//         console.error(`Error saving average entry for ${userName} - ${intervalType}:`, error);
//     }
// };


// // Schedule calculations for all intervals
// const scheduleAveragesCalculation = () => {
//     const intervals = [
//         { cronTime: '0 * * * *', interval: 'hour', duration: 60 * 60 * 1000 }, // Every hour
//         { cronTime: '0 0 * * *', interval: 'day', duration: 24 * 60 * 60 * 1000 }, // Every day
//         { cronTime: '0 0 * * 1', interval: 'week', duration: 7 * 24 * 60 * 60 * 1000 }, // Every week (Monday)
//         { cronTime: '0 0 1 * *', interval: 'month', duration: 30 * 24 * 60 * 60 * 1000 }, // Every month
//         { cronTime: '0 0 1 */6 *', interval: 'sixmonths', duration: 6 * 30 * 24 * 60 * 60 * 1000 }, // Every 6 months
//         { cronTime: '0 0 1 1 *', interval: 'year', duration: 365 * 24 * 60 * 60 * 1000 }, // Every year
//     ];
    
//     // const intervals = [
//     //     { cronTime: '*/1 * * * *', interval: 'minute', duration: 60 * 1000 }, // Every minute
//     //     { cronTime: '*/2 * * * *', interval: 'twoMinutes', duration: 2 * 60 * 1000 }, // Every 2 minutes
//     // ];

//     intervals.forEach(({ cronTime, interval, duration }) => {
//         cron.schedule(cronTime, async () => {
//             console.log(`Running ${interval} average calculation...`);
//             const users = await IotData.distinct('userName');
//             for (const userName of users) {
//                 const productIds = await IotData.distinct('product_id', { userName });
//                 for (const product_id of productIds) {
//                     const stackNames = await IotData.aggregate([
//                         { $match: { userName, product_id } },
//                         { $unwind: '$stackData' },
//                         { $group: { _id: '$stackData.stackName' } },
//                     ]).then(result => result.map(item => item._id));

//                     const now = new Date();
//                     const startTime = new Date(now.getTime() - duration);
//                     const endTime = now;

//                     for (const stackName of stackNames) {
//                         await calculateAverages(userName, product_id, stackName, startTime, endTime, interval);
//                     }
//                 }
//             }
//         });
//     });
// };
//scheduleAveragesCalculation();

// Adjust calculation to use IST (Indian Standard Time)
const calculateAverages = async (userName, product_id, startTime, endTime, interval, intervalType) => {
    //console.log(`Calculating averages for ${userName} - ${intervalType}: ${startTime} to ${endTime}`);

    const nowIST = moment().tz('Asia/Kolkata');

    // Check if an entry already exists for this user, interval, and intervalType
    const existingRecord = await IotDataAverage.findOne({
        userName,
        product_id,
        interval,
        intervalType,
        dateAndTime: nowIST.format('DD/MM/YYYY HH:mm'),
    });

    if (existingRecord) {
        console.log(`Average entry already exists for ${userName} - ${intervalType}. Skipping save operation.`);
        return; // Prevent duplicate save
    }

    // Aggregation query to fetch data
    const data = await IotData.aggregate([
        {
            $match: {
                userName,
                product_id,
                timestamp: { $gte: new Date(startTime), $lt: new Date(endTime) },
            },
        },
        { $unwind: '$stackData' },
        {
            $match: {
                'stackData.stackName': { $exists: true, $ne: null },
            },
        },
    ]);

    //console.log(`Extracted ${data.length} entries for ${userName} - ${intervalType}`);
    if (data.length === 0) return;

    // Grouping and calculating averages
    const stackGroups = data.reduce((acc, entry) => {
        const { stackName, stationType, ...parameters } = entry.stackData;
        if (!acc[stackName]) acc[stackName] = { stationType, parameters: {} };

        Object.entries(parameters).forEach(([key, value]) => {
            acc[stackName].parameters[key] = acc[stackName].parameters[key] || [];
            acc[stackName].parameters[key].push(parseFloat(value || 0));
        });

        return acc;
    }, {});

    const stackData = Object.entries(stackGroups).map(([stackName, { stationType, parameters }]) => {
        const averagedParameters = Object.entries(parameters).reduce((acc, [key, values]) => {
            const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
            acc[key] = parseFloat(avg.toFixed(2));
            return acc;
        }, {});

        return {
            stackName,
            stationType,
            parameters: averagedParameters,
        };
    });

    //console.log(`Averages for ${userName}:`, stackData);

    // Prepare and save the new average entry
    const averageEntry = new IotDataAverage({
        userName,
        product_id,
        interval,
        intervalType,
        dateAndTime: nowIST.format('DD/MM/YYYY HH:mm'), // Save in IST
        timestamp: nowIST.toDate(),
        stackData,
    });

    try {
        await averageEntry.save();
        //console.log(`Average entry saved for ${userName} - ${intervalType}`);
    } catch (error) {
        console.error(`Error saving average entry for ${userName} - ${intervalType}:`, error);
    }
};

// Schedule calculations for all intervals
const scheduleAveragesCalculation = () => {
    const intervals = [
        { cronTime: '0 * * * *', interval: 'hour', duration: 60 * 60 * 1000 }, // Every hour
        { cronTime: '0 0 * * *', interval: 'day', duration: 24 * 60 * 60 * 1000 }, // Every day
        { cronTime: '0 0 * * 1', interval: 'week', duration: 7 * 24 * 60 * 60 * 1000 }, // Every week (Monday)
        { cronTime: '0 0 1 * *', interval: 'month', duration: 30 * 24 * 60 * 60 * 1000 }, // Every month
        { cronTime: '0 0 1 */6 *', interval: 'sixmonths', duration: 6 * 30 * 24 * 60 * 60 * 1000 }, // Every 6 months
        { cronTime: '0 0 1 1 *', interval: 'year', duration: 365 * 24 * 60 * 60 * 1000 }, // Every year
    ];

    intervals.forEach(({ cronTime, interval, duration }) => {
        cron.schedule(cronTime, async () => {
           // console.log(`Running ${interval} average calculation...`);

            const now = moment().tz('Asia/Kolkata');
            const startTime = new Date(now.clone().subtract(duration, 'milliseconds').toDate());
            const endTime = new Date(now.toDate());

            const users = await IotData.distinct('userName');
            for (const userName of users) {
                const productIds = await IotData.distinct('product_id', { userName });
                for (const product_id of productIds) {
                    const stackNames = await IotData.aggregate([
                        { $match: { userName, product_id } },
                        { $unwind: '$stackData' },
                        { $group: { _id: '$stackData.stackName' } },
                    ]).then(result => result.map(item => item._id));

                    for (const stackName of stackNames) {
                        await calculateAverages(userName, product_id, stackName, startTime, endTime, interval);
                    }
                }
            }
        });
    });
};

// Configure AWS SDK
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

const s3 = new AWS.S3();

/**
 * Fetch data from S3 bucket.
 * @returns {Promise<Array>} - Parsed data from S3 file (JSON format).
 */
const fetchAverageDataFromS3 = async () => {
    try {
        const key = 'average_data/averageData.json';  // S3 file path

        console.log(`Fetching data from S3 with key: ${key}`);
        const params = {
            Bucket: 'ems-ebhoom-bucket', // Replace with your bucket name
            Key: key
        };

        const s3Object = await s3.getObject(params).promise();
        const fileContent = s3Object.Body.toString('utf-8');

        // Parse JSON content
        const jsonData = JSON.parse(fileContent);

        console.log("Fetched S3 Average Data Length:", jsonData.length);

        return jsonData;
    } catch (error) {
        console.error('Error fetching data from S3:', error);
        throw new Error('Failed to fetch average data from S3');
    }
};



// Controller function to fetch all average data
const getAllAverageData = async (req, res) => {
    try {
        const data = await fetchAverageDataFromS3(); // Fetch data from the S3 bucket

        if (!data || data.length === 0) {
            return res.status(404).json({ message: 'No average data found in S3.' });
        }

        res.status(200).json({
            success: true,
            message: 'All average data fetched successfully from S3',
            data
        });
    } catch (error) {
        console.error('Error fetching all average data from S3:', error);
        res.status(500).json({ message: 'Error fetching average data from S3.', error });
    }
};

// Controller function to fetch average data by userName
const findAverageDataUsingUserName = async (req, res) => {
    const { userName } = req.params;

    try {
        const data = await fetchAverageDataFromS3(); // Fetch data from the S3 bucket

        // Filter the data for the specific userName
        const filteredData = data.filter(entry => entry.userName === userName);

        if (!filteredData || filteredData.length === 0) {
            return res.status(404).json({ message: `No average data found for userName: ${userName} in S3.` });
        }

        res.status(200).json({
            success: true,
            message: `Average data for userName ${userName} fetched successfully from S3`,
            data: filteredData
        });
    } catch (error) {
        console.error(`Error fetching average data for userName ${userName} from S3:`, error);
        res.status(500).json({ message: 'Error fetching average data from S3.', error });
    }
};

const findAverageDataUsingUserNameAndStackName = async (req, res) => {
    const { userName, stackName } = req.params;

    try {
        const data = await fetchAverageDataFromS3(); // Fetch all data from the S3 bucket

        // Filter the data for the specific userName and stackName
        const filteredData = data
            .filter(entry => entry.userName === userName)
            .map(entry => ({
                ...entry,
                stackData: entry.stackData.filter(stack => stack.stackName === stackName),
            }))
            .filter(entry => entry.stackData.length > 0); // Ensure only non-empty entries are returned

        if (!filteredData || filteredData.length === 0) {
            return res.status(404).json({
                message: `No average data found for userName: ${userName} and stackName: ${stackName} in S3.`,
            });
        }

        res.status(200).json({
            success: true,
            message: `Average data for userName ${userName} and stackName ${stackName} fetched successfully from S3`,
            data: filteredData,
        });
    } catch (error) {
        console.error(`Error fetching average data for userName ${userName} and stackName ${stackName} from S3:`, error);
        res.status(500).json({ message: 'Error fetching average data from S3.', error });
    }
};
const findAverageDataUsingUserNameAndStackNameAndIntervalType = async (req, res) => {
    const { userName, stackName, intervalType } = req.params;

    try {
        // Fetch all average data from S3
        const allData = await fetchAverageDataFromS3();

        // Filter the data based on userName, stackName, and intervalType
        const filteredData = allData
            .filter(entry => entry.userName === userName && entry.intervalType === intervalType)
            .map(entry => ({
                ...entry,
                stackData: entry.stackData.filter(stack => stack.stackName === stackName),
            }))
            .filter(entry => entry.stackData.length > 0) // Ensure only non-empty stackData entries
            .slice(0, 24); // Limit to the last 24 records

        if (!filteredData || filteredData.length === 0) {
            return res.status(404).json({
                message: `No average data found for userName: ${userName}, stackName: ${stackName}, and intervalType: ${intervalType} in S3.`,
            });
        }

        res.status(200).json({
            status: 200,
            success: true,
            message: `Last 24 average data points fetched successfully from S3 for user ${userName}, stack ${stackName}, and interval type ${intervalType}.`,
            data: filteredData,
        });
    } catch (error) {
        console.error(`Error fetching average data for user ${userName}, stack ${stackName}, and interval type ${intervalType} from S3:`, error);
        res.status(500).json({ message: 'Error fetching average data from S3.', error });
    }
};



const findAverageDataUsingUserNameAndStackNameAndIntervalTypeWithTimeRange = async (req, res) => {
    const { userName, stackName, intervalType } = req.params;
    const { startTime, endTime, page = 1, limit = 10 } = req.query; // Include page and limit for pagination

    try {
        // Parse start and end dates
        const startDate = moment(startTime, 'DD-MM-YYYY', true).format('YYYY-MM-DD');
        const endDate = moment(endTime, 'DD-MM-YYYY', true).format('YYYY-MM-DD');

        if (!startDate || !endDate || !moment(startDate).isValid() || !moment(endDate).isValid()) {
            return res.status(400).json({ message: 'Invalid start or end date format. Use DD-MM-YYYY.' });
        }

        // Fetch all average data from S3
        const allData = await fetchAverageDataFromS3();
        console.log('Fetched S3 Average Data Length:', allData.length);

        // Filter data for the specific userName, intervalType, and date range
        const filteredData = allData
            .filter(entry => {
                const dateValid = moment(entry.dateAndTime, 'DD/MM/YYYY').isBetween(startDate, endDate, 'day', '[]');
                const userMatch = entry.userName.trim().toLowerCase() === userName.trim().toLowerCase();
                const intervalMatch = entry.intervalType.trim().toLowerCase() === intervalType.trim().toLowerCase();
                return userMatch && intervalMatch && dateValid;
            })
            .map(entry => ({
                ...entry,
                stackData: entry.stackData.filter(stack => stack.stackName.trim().toLowerCase() === stackName.trim().toLowerCase()),
            }))
            .filter(entry => entry.stackData.length > 0); // Ensure only non-empty stackData entries

        if (!filteredData || filteredData.length === 0) {
            return res.status(404).json({
                message: `No average data found for userName: ${userName}, stackName: ${stackName}, intervalType: ${intervalType}, and the specified time range in S3.`,
            });
        }

        // Implement pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);

        const paginatedData = filteredData.slice(startIndex, endIndex);

        res.status(200).json({
            status: 200,
            success: true,
            message: `Average data fetched successfully from S3 for user ${userName}, stack ${stackName}, interval type ${intervalType}, and time range.`,
            data: paginatedData,
            pagination: {
                totalRecords: filteredData.length,
                totalPages: Math.ceil(filteredData.length / limit),
                currentPage: parseInt(page),
                limit: parseInt(limit),
            },
        });
    } catch (error) {
        console.error(
            `Error fetching data for user ${userName}, stack ${stackName}, interval type ${intervalType}, and time range from S3:`,
            error
        );
        res.status(500).json({
            message: 'Error fetching average data from S3.',
            error: error.message,
        });
    }
};




const downloadAverageDataWithUserNameStackNameAndIntervalWithTimeRange = async (req, res) => {
    try {
        const { userName, stackName, intervalType } = req.params;
        const { startTime, endTime, format } = req.query;

        // Validate the input parameters
        if (!userName || !stackName || !intervalType || !startTime || !endTime || !format) {
            return res.status(400).json({ success: false, message: 'Missing required query parameters.' });
        }

        // Parse and format dates
        const startDate = moment(startTime, 'DD-MM-YYYY').startOf('day');
        const endDate = moment(endTime, 'DD-MM-YYYY').endOf('day');

        if (!startDate.isValid() || !endDate.isValid()) {
            return res.status(400).json({ success: false, message: 'Invalid date format. Use "DD-MM-YYYY".' });
        }

        // Fetch data from S3
        const allData = await fetchAverageDataFromS3();
        console.log('Fetched S3 Average Data Length:', allData.length);

        // Debugging: Log first few entries for review
        console.log('Sample S3 Data:', allData.slice(0, 5));

        // Filter data for userName, stackName, intervalType, and date range
        const filteredData = allData
            .filter(entry => {
                const entryDate = moment(entry.dateAndTime, 'DD/MM/YYYY');
                const dateValid =
                    entryDate.isSameOrAfter(startDate, 'day') && entryDate.isSameOrBefore(endDate, 'day');
                const userMatch = entry.userName.trim().toLowerCase() === userName.trim().toLowerCase();
                const intervalMatch = entry.intervalType.trim().toLowerCase() === intervalType.trim().toLowerCase();

                // Log every filtering step
                console.log(
                    `Checking entry: userName=${entry.userName}, intervalType=${entry.intervalType}, dateAndTime=${entry.dateAndTime}`
                );

                return userMatch && intervalMatch && dateValid;
            })
            .map(entry => ({
                ...entry,
                stackData: entry.stackData.filter(stack =>
                    stack.stackName.trim().toLowerCase() === stackName.trim().toLowerCase()
                ),
            }))
            .filter(entry => entry.stackData.length > 0); // Ensure only non-empty stackData entries

        // Log the result of the filtering
        console.log('Filtered Data Length:', filteredData.length);

        if (!filteredData || filteredData.length === 0) {
            return res.status(404).json({ success: false, message: 'No data found for the specified criteria.' });
        }

        // Extract dynamic fields from the stackData
        const stackKeys = Object.keys(filteredData[0].stackData[0]?.parameters || {}).filter(key => key !== '_id');

        if (format === 'csv') {
            const fields = ['Date', 'Time', 'Stack Name', ...stackKeys];

            const csvData = filteredData.flatMap(item =>
                item.stackData.map(stack => ({
                    Date: moment(item.dateAndTime, 'DD/MM/YYYY').format('DD-MM-YYYY'),
                    Time: moment(item.dateAndTime, 'DD/MM/YYYY HH:mm:ss').format('HH:mm:ss'),
                    'Stack Name': stack.stackName,
                    ...stack.parameters,
                }))
            );

            const parser = new Parser({ fields });
            const csv = parser.parse(csvData);

            res.header('Content-Type', 'text/csv');
            res.attachment(`${userName}_${stackName}_average_data.csv`);
            return res.send(csv);
        } else if (format === 'pdf') {
            const doc = new PDFDocument();
            res.header('Content-Type', 'application/pdf');
            res.attachment(`${userName}_${stackName}_average_data.pdf`);

            doc.pipe(res);
            doc.fontSize(20).text('Average Data Report', { align: 'center' });
            doc.fontSize(12).text(`User Name: ${userName}`);
            doc.fontSize(12).text(`Stack Name: ${stackName}`);
            doc.fontSize(12).text(`Interval Type: ${intervalType}`);
            doc.fontSize(12).text(`Date Range: ${startTime} - ${endTime}`);
            doc.moveDown();

            filteredData.forEach(item => {
                item.stackData.forEach(stack => {
                    doc.fontSize(12).text(`Date: ${moment(item.dateAndTime, 'DD/MM/YYYY').format('DD-MM-YYYY')}`);
                    doc.text(`Time: ${moment(item.dateAndTime, 'DD/MM/YYYY HH:mm:ss').format('HH:mm:ss')}`);
                    doc.fontSize(12).text(`Stack: ${stack.stackName}`, { underline: true });

                    const keys = Object.keys(stack.parameters || {});
                    const tableData = keys.map(key => `${key}: ${stack.parameters[key]}`).join(', ');

                    doc.text(tableData);
                    doc.moveDown();
                });
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



module.exports = { calculateAverages, scheduleAveragesCalculation,findAverageDataUsingUserName,
    findAverageDataUsingUserNameAndStackName,getAllAverageData,findAverageDataUsingUserNameAndStackNameAndIntervalType,
    findAverageDataUsingUserNameAndStackNameAndIntervalTypeWithTimeRange,
    downloadAverageDataWithUserNameStackNameAndIntervalWithTimeRange,
};
