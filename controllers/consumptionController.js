const IotData = require('../models/iotData');
const ConsumptionData = require('../models/ConsumptionData');
const moment = require('moment-timezone');
const cron = require('node-cron');
const getInflowOutflow = async (userName, product_id) => {
    try {
        const data = await IotData.find({ userName, product_id })
            .sort({ timestamp: -1 }) // Sort by latest first
            .limit(2); // Get last two records

        if (data.length < 2) {
            console.log("Not enough data points for inflow calculation.");
            return { inflowData: {}, outflowData: {} };
        }

        let inflowData = {};
        let outflowData = {};

        // Loop through stackData to calculate inflow and outflow
        data[1].stackData.forEach((prevStack) => {
            const currentStack = data[0].stackData.find(s => s.stackName === prevStack.stackName);

            if (currentStack) {
                // Ensure cumulatingFlow is defined, default to 0 if missing
                const prevCumulatingFlow = prevStack.cumulatingFlow || 0;
                const currentCumulatingFlow = currentStack.cumulatingFlow || 0;

                // Calculate inflow as the difference in cumulative flow
                const inflow = currentCumulatingFlow - prevCumulatingFlow;
                inflowData[prevStack.stackName] = inflow < 0 ? 0 : inflow; // Avoid negative values

                // Calculate outflow for outlets and ETP
                if (prevStack.stackName.includes("outlet") || prevStack.stackName.includes("ETP")) {
                    outflowData[prevStack.stackName] = currentCumulatingFlow;
                }
            }
        });

        return {
            inflowData,
            outflowData
        };

    } catch (error) {
        console.error("Error in calculating inflow/outflow:", error);
        return { inflowData: {}, outflowData: {} };
    }
};

// Function to filter IoT data by station type and calculate total consumption
const calculateTotalConsumption = async (userName, product_id, startTime, endTime, intervalType) => {
    try {
        // Fetch inflow and outflow data using the helper function
        const { inflowData, outflowData } = await getInflowOutflow(userName, product_id);

        // Log inflow and outflow data for debugging
        console.log("Inflow Data:", inflowData);
        console.log("Outflow Data:", outflowData);

        // Fetch the aggregated data for the given time range
        const aggregatedData = await IotData.aggregate([
            {
                $match: {
                    userName,
                    product_id,
                    timestamp: { $gte: startTime, $lt: endTime }
                }
            },
            { $unwind: '$stackData' },
            {
                $match: {
                    'stackData.stationType': { $in: ['energy', 'effluent_flow'] } // Filter relevant station types
                }
            },
            {
                $group: {
                    _id: '$stackData.stackName',
                    stationType: { $first: '$stackData.stationType' },
                    inflow: { $sum: { $ifNull: ['$stackData.inflow', 0] } },
                    finalflow: { $sum: { $ifNull: ['$stackData.cumulatingFlow', 0] } },
                    energy: { $sum: { $ifNull: ['$stackData.energy', 0] } }
                }
            }
        ]);

        if (aggregatedData.length === 0) {
            console.log(`No relevant data found for ${userName} - ${intervalType}`);
            return;
        }

        // Fetch user details
        const userRecord = await IotData.findOne(
            { userName, product_id },
            { companyName: 1, email: 1, mobileNumber: 1 }
        );

        if (!userRecord) {
            console.error(`No user record found for ${userName}`);
            return;
        }

        // Format the interval timestamp in IST
        const intervalIST = moment()
            .tz('Asia/Kolkata')
            .format('ddd MMM DD YYYY HH:mm:ss [GMT+0530] (India Standard Time)');

        // Create the consumption entry
        const consumptionEntry = new ConsumptionData({
            userName,
            product_id,
            companyName: userRecord.companyName,
            email: userRecord.email,
            mobileNumber: userRecord.mobileNumber,
            interval: intervalIST,
            intervalType,
            totalConsumptionData: aggregatedData.map(stack => ({
                stackName: stack._id,
                stationType: stack.stationType || 'NIL',
                inflow: inflowData[stack._id] || 0,  // Use calculated inflow
                finalflow: outflowData[stack._id] || 0, // Use calculated outflow
                energy: stack.energy || 0
            }))
        });

        // Save the consumption entry
        await consumptionEntry.save();
        console.log(`Saved consumption data for ${userName} - ${intervalType}`);
    } catch (error) {
        console.error(`Error in calculating consumption: ${error.message}`);
    }
};
// Helper function to get the start and end time for the interval
const getStartAndEndTime = (intervalType) => {
    const endTime = moment().utc();
    const startTime = {
        '15Minutes': endTime.clone().subtract(15, 'minutes'),
        '30Minutes': endTime.clone().subtract(30, 'minutes'),
        'hourly': endTime.clone().subtract(1, 'hour'),
        'daily': endTime.clone().subtract(1, 'day'),
        'monthly': endTime.clone().subtract(1, 'month'),
        'yearly': endTime.clone().subtract(1, 'year')
    }[intervalType];

    if (!startTime) throw new Error(`Unsupported interval type: ${intervalType}`);
    return { startTime: startTime.toDate(), endTime: endTime.toDate() };
};

// Function to run the consumption calculation for all users and products
const runConsumptionCalculation = async (intervalType) => {
    try {
        const users = await IotData.distinct('userName');
        // console.log(`Users found: ${users}`);

        for (const userName of users) {
            const productIds = await IotData.distinct('product_id', { userName });
            // console.log(`Product IDs for ${userName}: ${productIds}`);

            for (const product_id of productIds) {
                const { startTime, endTime } = getStartAndEndTime(intervalType);
                // console.log(`Calculating for ${userName}, product_id: ${product_id}, interval: ${intervalType}`);
                await calculateTotalConsumption(userName, product_id, startTime, endTime, intervalType);
            }
        }
    } catch (error) {
        console.error(`Error in running ${intervalType} consumption calculation:`, error);
    }
};

// Schedule calculations for different intervals using cron
const scheduleTotalConsumptionCalculation = () => {
    const intervals = [
        { cronTime: '0 * * * *', intervalType: 'hourly' },
        { cronTime: '0 0 * * *', intervalType: 'daily' },
        { cronTime: '0 0 1 * *', intervalType: 'monthly' },
        { cronTime: '0 0 1 1 *', intervalType: 'yearly' }
    ];

    intervals.forEach(({ cronTime, intervalType }) => {
        console.log(`Scheduled ${intervalType} consumption calculation.`);
        cron.schedule(cronTime, async () => {
            console.log(`Running ${intervalType} consumption calculation...`);
            await runConsumptionCalculation(intervalType);
        });
    });
};




// Get consumption data by userName and stackName
const getConsumptionDataByUserNameAndStackName = async (req, res) => {
    const { userName, stackName } = req.params;

    try {
        // Find all consumption data matching the userName and containing the specified stackName
        const data = await ConsumptionData.find({
            userName,
            'totalConsumptionData.stackName': stackName
        });

        if (!data || data.length === 0) {
            return res.status(404).json({ message: 'No data found for the specified user and stack.' });
        }

        // Filter to keep only the relevant stack data
        const filteredData = data.map(entry => ({
            ...entry._doc, // Spread the entry to avoid mutation of original data
            totalConsumptionData: entry.totalConsumptionData.filter(
                stack => stack.stackName === stackName
            ),
        }));

        res.status(200).json(filteredData);
    } catch (error) {
        console.error(`Error fetching data for user ${userName} and stack ${stackName}:`, error);
        res.status(500).json({ message: 'Error fetching consumption data.', error });
    }
};


// Get all consumption data by userName
const getConsumptionDataByUserName = async (req, res) => {
    const { userName } = req.params;

    try {
        const data = await ConsumptionData.find({ userName });

        if (data.length === 0) {
            return res.status(404).json({ message: 'No data found for the specified user.' });
        }

        res.status(200).json(data);
    } catch (error) {
        console.error(`Error fetching data: ${error.message}`);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// Controller to fetch consumption data by userName, fromDate, and toDate
// Controller to fetch consumption data by userName, fromDate, and toDate
// Controller to fetch consumption data by userName, fromDate, and toDate
// const getConsumptionDataByUserNameAndDateRange = async (req, res) => {
//     const { userName,intervalType } = req.params;
//     const { fromDate, toDate } = req.query;

//     if (!fromDate || !toDate) {
//         return res.status(400).json({ message: "Both 'fromDate' and 'toDate' are required." });
//     }

//     try {
//         // Convert fromDate and toDate from dd/mm/yyyy to Date objects
//         const fromParts = fromDate.split('/');
//         const toParts = toDate.split('/');

//         if (fromParts.length !== 3 || toParts.length !== 3) {
//             return res.status(400).json({ message: "Invalid date format. Use 'dd/mm/yyyy'." });
//         }

//         const from = new Date(`${fromParts[2]}-${fromParts[1]}-${fromParts[0]}T00:00:00Z`);
//         const to = new Date(`${toParts[2]}-${toParts[1]}-${toParts[0]}T23:59:59Z`);

//         if (isNaN(from.getTime()) || isNaN(to.getTime())) {
//             return res.status(400).json({ message: "Invalid date format. Use 'dd/mm/yyyy'." });
//         }

//         // Find the last entered data for each day within the specified date range
//         const data = await ConsumptionData.aggregate([
//             {
//                 $match: {
//                     userName,
//                     timestamp: { $gte: from, $lte: to },
//                 },
//             },
//             {
//                 $group: {
//                     _id: {
//                         day: { $dayOfMonth: "$timestamp" },
//                         month: { $month: "$timestamp" },
//                         year: { $year: "$timestamp" },
//                     },
//                     lastEntry: { $last: "$$ROOT" },
//                 },
//             },
//             {
//                 $replaceRoot: { newRoot: "$lastEntry" },
//             },
//             {
//                 $sort: { timestamp: 1 },
//             },
//         ]);

//         if (!data || data.length === 0) {
//             return res.status(404).json({ message: "No data found for the specified user and date range." });
//         }

//         res.status(200).json(data);
//     } catch (error) {
//         console.error(
//             `Error fetching data for user ${userName} from ${fromDate} to ${toDate}:`,
//             error
//         );
//         res.status(500).json({ message: "Error fetching consumption data.", error });
//     }
// };

const getConsumptionDataByUserNameAndDateRange = async (req, res) => {
    const { userName, intervalType } = req.params;
    const { fromDate, toDate } = req.query;

    if (!fromDate || !toDate) {
        return res.status(400).json({ message: "Both 'fromDate' and 'toDate' are required." });
    }

    try {
        // Convert fromDate and toDate from dd/mm/yyyy to Date objects
        const fromParts = fromDate.split('/');
        const toParts = toDate.split('/');

        if (fromParts.length !== 3 || toParts.length !== 3) {
            return res.status(400).json({ message: "Invalid date format. Use 'dd/mm/yyyy'." });
        }

        const from = new Date(`${fromParts[2]}-${fromParts[1]}-${fromParts[0]}T00:00:00Z`);
        const to = new Date(`${toParts[2]}-${toParts[1]}-${toParts[0]}T23:59:59Z`);

        if (isNaN(from.getTime()) || isNaN(to.getTime())) {
            return res.status(400).json({ message: "Invalid date format. Use 'dd/mm/yyyy'." });
        }

        // Find the last entered data for each day within the specified date range
        const data = await ConsumptionData.aggregate([
            {
                $match: {
                    userName,
                    intervalType,
                    timestamp: { $gte: from, $lte: to },
                },
            },
            {
                $group: {
                    _id: {
                        day: { $dayOfMonth: "$timestamp" },
                        month: { $month: "$timestamp" },
                        year: { $year: "$timestamp" },
                    },
                    lastEntry: { $last: "$$ROOT" },
                },
            },
            // Filter out groups where the last entry is null
            {
                $match: { lastEntry: { $ne: null } },
            },
            {
                $replaceRoot: { newRoot: "$lastEntry" },
            },
            {
                $sort: { timestamp: 1 },
            },
        ]);

        if (!data || data.length === 0) {
            return res.status(404).json({
                message: "No data found for the specified user, intervalType, and date range.",
            });
        }

        res.status(200).json(data);
    } catch (error) {
        console.error(
            `Error fetching data for user ${userName} with intervalType ${intervalType} from ${fromDate} to ${toDate}:`,
            error
        );
        res.status(500).json({ message: "Error fetching consumption data.", error });
    }
};


// Get all consumption data (no filter)
const getAllConsumptionData = async (req, res) => {
    try {
        const data = await ConsumptionData.find();

        if (data.length === 0) {
            return res.status(404).json({ message: 'No data available.' });
        }

        res.status(200).json(data);
    } catch (error) {
        console.error(`Error fetching data: ${error.message}`);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

const getConsumptionDataByUserNameAndStackNameAndInterval = async (req, res) => {
    const { userName, stackName, intervalType } = req.params;

    try {
        // Find consumption data matching userName, intervalType, and stackName
        const data = await ConsumptionData.find({
            userName,
            intervalType,
            'totalConsumptionData.stackName': stackName,
        });

        if (!data || data.length === 0) {
            return res.status(404).json({
                message: 'No consumption data found for this user, stack name, and interval type.'
            });
        }

        // Filter the stack data to only keep matching stackName
        const filteredData = data.map(entry => ({
            ...entry._doc, // Spread the entry to avoid mutation
            totalConsumptionData: entry.totalConsumptionData.filter(
                stack => stack.stackName === stackName
            ),
        }));

        res.status(200).json(filteredData);
    } catch (error) {
        console.error(
            `Error fetching data for user ${userName}, stack ${stackName}, and interval type ${intervalType}:`,
            error
        );
        res.status(500).json({ message: 'Error fetching consumption data.', error });
    }
};
const getTodayConsumptionData = async (req, res) => {
    const { userName } = req.query;

    try {
        if (!userName) {
            return res.status(400).json({ message: "Missing required query parameter: userName." });
        }

        const today = moment().format('DD/MM/YYYY');
        const todayData = await ConsumptionData.find({ userName, date: today }).sort({ hour: -1 }).limit(1);

        if (!todayData || todayData.length === 0) {
            return res.status(404).json({ message: "No consumption data found for today." });
        }

        res.json({
            message: "Last consumption data of the day fetched successfully.",
            data: todayData[0],
        });
    } catch (error) {
        console.error("Error fetching last consumption data of the day:", error);
        res.status(500).json({ message: "Internal server error.", error: error.message });
    }
};
module.exports = { 
    scheduleTotalConsumptionCalculation, 
    calculateTotalConsumption,
    getConsumptionDataByUserNameAndStackName,
    getConsumptionDataByUserName,
    getAllConsumptionData,
    getConsumptionDataByUserNameAndStackNameAndInterval,
    getConsumptionDataByUserNameAndDateRange,
    getTodayConsumptionData, getInflowOutflow ,
};
