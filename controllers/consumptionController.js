const IotData = require('../models/iotData');
const ConsumptionData = require('../models/ConsumptionData');
const moment = require('moment-timezone');
const cron = require('node-cron');

// Function to filter IoT data by station type and calculate total consumption
const calculateTotalConsumption = async (userName, product_id, startTime, endTime, intervalType) => {
    try {
        const data = await IotData.aggregate([
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
                    finalflow: { $sum: { $ifNull: ['$stackData.finalflow', 0] } },
                    energy: { $sum: { $ifNull: ['$stackData.energy', 0] } }
                }
            }
        ]);

        if (data.length === 0) {
            console.log(`No relevant data found for ${userName} - ${intervalType}`);
            return;
        }

        const userRecord = await IotData.findOne(
            { userName, product_id },
            { companyName: 1, email: 1, mobileNumber: 1 }
        );

        if (!userRecord) {
            console.error(`No user record found for ${userName}`);
            return;
        }

        const intervalIST = moment()
            .tz('Asia/Kolkata')
            .format('ddd MMM DD YYYY HH:mm:ss [GMT+0530] (India Standard Time)');

        const consumptionEntry = new ConsumptionData({
            userName,
            product_id,
            companyName: userRecord.companyName,
            email: userRecord.email,
            mobileNumber: userRecord.mobileNumber,
            interval: intervalIST,
            intervalType,
            totalConsumptionData: data.map(stack => ({
                stackName: stack._id,
                stationType: stack.stationType || 'NIL',
                inflow: stack.inflow || 0,
                finalflow: stack.finalflow || 0,
                energy: stack.energy || 0
            }))
        });

        await consumptionEntry.save();
        // console.log(`Saved consumption data for ${userName} - ${intervalType}`);
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
        cron.schedule(cronTime, async () => {
            // console.log(`Running ${intervalType} consumption calculation...`);
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

module.exports = { 
    scheduleTotalConsumptionCalculation, 
    calculateTotalConsumption,
    getConsumptionDataByUserNameAndStackName,
    getConsumptionDataByUserName,
    getAllConsumptionData,
    getConsumptionDataByUserNameAndStackNameAndInterval 
};
