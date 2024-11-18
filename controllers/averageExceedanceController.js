const AverageExceedance = require('../models/AverageExceedance');
const CalibrationExceed = require('../models/calibrationExceed');
const moment = require('moment-timezone');
const cron = require('node-cron');

const calculateExceedanceAverages = async (userName, startTime, endTime, interval, intervalType) => {
    console.log(`Calculating exceedance averages for ${userName} - ${intervalType}: ${startTime} to ${endTime}`);

    const nowIST = moment().tz('Asia/Kolkata');

    // Check for existing record to avoid duplicates
    const existingRecord = await AverageExceedance.findOne({
        userName,
        interval,
        intervalType,
        dateAndTime: nowIST.format('DD/MM/YYYY HH:mm'),
    });

    if (existingRecord) {
        console.log(`Average exceedance entry already exists for ${userName} - ${intervalType}. Skipping save.`);
        return;
    }

    // Fetch exceedance data for the given interval
    const data = await CalibrationExceed.aggregate([
        {
            $match: {
                userName,
                timestamp: { $gte: new Date(startTime), $lt: new Date(endTime) },
            },
        },
    ]);

    console.log(`Fetched ${data.length} entries for exceedance - ${intervalType}`);
    if (data.length === 0) return;

    // Group and average exceedance values by stackName and parameter
    const stackGroups = data.reduce((acc, entry) => {
        const { stackName, parameter, value } = entry;

        if (!acc[stackName]) acc[stackName] = {};
        acc[stackName][parameter] = acc[stackName][parameter] || [];
        acc[stackName][parameter].push(parseFloat(value || 0));

        return acc;
    }, {});

    // Format the stack data with averaged parameter values
    const stackData = Object.entries(stackGroups).map(([stackName, parameters]) => {
        const averagedParameters = Object.entries(parameters).reduce((acc, [key, values]) => {
            const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
            acc[key] = parseFloat(avg.toFixed(2));
            return acc;
        }, {});

        return {
            stackName,
            parameters: averagedParameters,
        };
    });

    // Save the new average exceedance entry
    const averageEntry = new AverageExceedance({
        userName,
        interval,
        intervalType,
        dateAndTime: nowIST.format('DD/MM/YYYY HH:mm'),
        timestamp: nowIST.toDate(),
        stackData,
    });

    try {
        await averageEntry.save();
        console.log(`Average exceedance entry saved for ${userName} - ${intervalType}`);
    } catch (error) {
        console.error(`Error saving average exceedance for ${userName} - ${intervalType}:`, error);
    }
};

// Scheduling calculations for 15min, 30min, hourly, and monthly intervals
const scheduleExceedanceAveragesCalculation = () => {
    const intervals = [
        { cronTime: '*/15 * * * *', interval: '15Minutes', duration: 15 * 60 * 1000 },
        { cronTime: '*/30 * * * *', interval: '30Minutes', duration: 30 * 60 * 1000 },
        { cronTime: '0 * * * *', interval: 'hour', duration: 60 * 60 * 1000 },
        { cronTime: '0 0 1 * *', interval: 'month', duration: 30 * 24 * 60 * 60 * 1000 },
    ];

    intervals.forEach(({ cronTime, interval, duration }) => {
        cron.schedule(cronTime, async () => {
            console.log(`Running ${interval} exceedance average calculation...`);

            const now = moment().tz('Asia/Kolkata');
            const startTime = new Date(now.clone().subtract(duration, 'milliseconds').toDate());
            const endTime = new Date(now.toDate());

            const users = await CalibrationExceed.distinct('userName');
            for (const userName of users) {
                await calculateExceedanceAverages(userName, startTime, endTime, interval, interval);
            }
        });
    });
};

module.exports = { scheduleExceedanceAveragesCalculation, calculateExceedanceAverages };
