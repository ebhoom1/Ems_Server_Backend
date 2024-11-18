const ExceedanceStats = require('../models/ExceedanceStats');
const IotData = require('../models/iotData');
const moment = require('moment');

// Helper function to aggregate exceedance and interval counts
const calculateExceedanceCounts = async (period) => {
    let matchConditions = {};
    const currentDate = moment().format('DD/MM/YYYY');

    if (period === 'hourly') {
        const currentHour = moment().hour();
        matchConditions = { date: currentDate, time: { $regex: `^${currentHour.toString().padStart(2, '0')}:` } };
    } else if (period === 'daily') {
        matchConditions = { date: currentDate };
    } else if (period === 'monthly') {
        const currentMonth = moment().format('MM/YYYY');
        matchConditions = { date: { $regex: `/${currentMonth}$` } };
    }

    const data = await IotData.find(matchConditions);
    
    let exceedanceCount = 0;
    let intervalExceedanceCount = 0;

    data.forEach(entry => {
        if (entry.ExceedanceColor === 'red') exceedanceCount++;
        if (entry.timeIntervalColor === 'purple') intervalExceedanceCount++;
    });

    return { exceedanceCount, intervalExceedanceCount };
};

// Function to save calculated counts to the database
const saveExceedanceStats = async (period) => {
    const { exceedanceCount, intervalExceedanceCount } = await calculateExceedanceCounts(period);
    const currentDate = moment().format('DD/MM/YYYY');
    const currentHour = moment().hour();

    const newExceedanceStats = new ExceedanceStats({
        date: currentDate,
        hour: period === 'hourly' ? currentHour : undefined,
        exceedanceCount,
        intervalExceedanceCount,
        period
    });

    await newExceedanceStats.save();
    console.log(`Exceedance stats saved for period: ${period}`);
};

const scheduleCountCalculation = () => {
// Define the intervals for scheduling exceedance calculations
const intervals = [
    { cronTime: '*/15 * * * *', interval: '15Minutes' }, // Every 15 minutes
    { cronTime: '*/30 * * * *', interval: '30Minutes' }, // Every 30 minutes
    { cronTime: '0 * * * *', interval: 'hourly' }, // Every hour
    { cronTime: '0 0 * * *', interval: 'daily' }, // Every day at midnight
    { cronTime: '0 0 * * 1', interval: 'weekly' }, // Every week (Monday at midnight)
    { cronTime: '0 0 1 * *', interval: 'monthly' }, // Every month (1st at midnight)
    { cronTime: '0 0 1 */6 *', interval: 'sixmonths' }, // Every 6 months (1st at midnight)
    { cronTime: '0 0 1 1 *', interval: 'yearly' } // Every year (January 1st at midnight)
];

// Schedule calculations for each interval
intervals.forEach(({ cronTime, interval }) => {
    cron.schedule(cronTime, async () => {
        console.log(`Running ${interval} exceedance count calculation...`);
        await saveExceedanceStats(interval);
    });
});
}
module.exports = { saveExceedanceStats };
