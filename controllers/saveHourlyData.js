const moment = require('moment');
const cron = require('node-cron');

const HourlyData = require('../models/hourlyData'); // Adjust path as necessary
const IotData = require('../models/iotData'); // Assuming the model is named IotData and imported accordingly
const {calculateAndSaveConsumption} = require('./consumption');

const saveHourlyData = async () => {
    const hour = moment().subtract(1, 'hours').format('HH');
    const startOfHour = moment().startOf('hour').subtract(1, 'hour');
    const endOfHour = moment(startOfHour).endOf('hour');
  
    console.log(`Initiating hourly data save for hour: ${hour}`);

    try {
        const lastEntries = await IotData.aggregate([
            {
                $match: {
                    timestamp: { $gte: startOfHour.toDate(), $lte: endOfHour.toDate() },
                    'stackData.stationType': { $in: ['energy', 'effluent_flow'] }
                }
            },
            {
                $sort: { timestamp: -1 }
            },
            {
                $group: {
                    _id: '$userName', // Group by user
                    latestEntry: { $first: '$$ROOT' }
                }
            },
            {
                $replaceRoot: { newRoot: "$latestEntry" }
            }
        ]);

        console.log(`Found ${lastEntries.length} entries to process.`);

        for (let entry of lastEntries) {
            const stacks = entry.stackData.filter(stack => stack.stationType === 'energy' || stack.stationType === 'effluent_flow');

            const hourlyRecord = {
                userName: entry.userName,
                product_id: entry.product_id,
                hour,
                date: moment(entry.timestamp).format('DD/MM/YYYY'),
                month: moment(entry.timestamp).format('MM'), // Save the month
                year: moment(entry.timestamp).format('YYYY'), // Save the year
                stacks: stacks.map(stack => ({
                    stackName: stack.stackName,
                    stationType: stack.stationType,
                    energy: stack.energy,
                    cumulatingFlow: stack.cumulatingFlow
                }))
            };

            const hourlyData = new HourlyData(hourlyRecord);
            await hourlyData.save();
  
            //calculate it automatically it run
            calculateAndSaveConsumption();
            console.log(`Hourly data saved for user: ${entry.userName} at hour: ${hour}`);
        }
    } catch (error) {
        console.error('Error saving hourly data:', error);
    }
};

// Schedule the task to run at the beginning of every hour
// Function to setup cron job
const setupCronJob = () => {
    // Schedule the task to run at the beginning of every hour
    cron.schedule('0 * * * *', async () => {
        console.log('Cron job triggered: saveHourlyData');
        await saveHourlyData();
    });
};


const getHourlyDataOfCumulatingFlowAndEnergy = async (req, res) => {
    const { userName, stackName, date } = req.query; // Assuming the parameters are passed as query parameters

    if (!userName || !stackName || !date) {
        return res.status(400).json({
            success: false,
            message: 'Missing required query parameters (userName, stackName, date).'
        });
    }

    try {
        const dateQuery = {};
        if (/^\d{4}$/.test(date)) { // Year only, e.g., '2024'
            dateQuery['year'] = date;
        } else if (/^\d{1,2}$/.test(date)) { // Month only, e.g., '11'
            dateQuery['month'] = date.padStart(2, '0'); // Ensuring two-digit month
            dateQuery['year'] = new Date().getFullYear().toString(); // Default to current year if only month is given
        } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) { // Full date, e.g., '04/11/2024'
            dateQuery['date'] = date;
        } else {
            return res.status(400).json({
                success: false,
                message: 'Date format is invalid. Use YYYY, MM, or DD/MM/YYYY format.'
            });
        }

        const results = await HourlyData.aggregate([
            {
                $match: {
                    userName: userName,
                    ...dateQuery,
                    "stacks.stackName": stackName
                }
            },
            {
                $unwind: "$stacks"
            },
            {
                $match: {
                    "stacks.stackName": stackName
                }
            },
            {
                $group: {
                    _id: {
                        hour: "$hour",
                        stackName: "$stacks.stackName"
                    },
                    latestEntry: { $last: "$stacks" },
                    date: { $last: "$date" },
                    userName: { $last: "$userName" }
                }
            },
            {
                $sort: { "_id.hour": 1 } // Sorting by hour for better readability
            }
        ]);

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No data found for the provided parameters.'
            });
        }

        return res.status(200).json({
            success: true,
            data: results.map(item => ({
                hour: item._id.hour,
                date: item.date,
                userName: item.userName,
                stack: item.latestEntry
            }))
        });
    } catch (error) {
        console.error('Error fetching hourly data:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching data',
            error: error.message
        });
    }
};

    


module.exports = { setupCronJob,getHourlyDataOfCumulatingFlowAndEnergy };
