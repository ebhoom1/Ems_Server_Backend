const moment = require('moment');
const HourlyData = require('../models/hourlyData');
const Consumption = require('../models/Consumption');
const cron = require('node-cron');
const { io, server } = require('../app');



// Helper function to ensure values are numeric, defaulting to 0 if missing
const ensureNumber = (value) => (typeof value === 'number' ? value : 0);

// Fetch data with a safeguard against missing data
const fetchDataForCalculation = async (date, hour) => {
    const result = await HourlyData.findOne({ date: date, hour: String(hour) });
    if (!result) return { stacks: [], userName: '', product_id: '' }; // Ensure defaults if no data found
    return result;
};

const calculateAndSaveConsumption = async () => {
    const now = moment().subtract(1, 'hours');
    const currentHour = now.format('HH');
    const currentDate = now.format('DD/MM/YYYY');
    const currentMonth = now.format('MM');

    console.log(`Fetching data for current hour: ${currentHour}, Date: ${currentDate}`);

    try {
        const [currentHourData, previousHourData, startOfDay, startOfMonth, startOfYear] = await Promise.all([
            fetchDataForCalculation(currentDate, currentHour),
            fetchDataForCalculation(currentDate, currentHour - 1),
            fetchDataForCalculation(currentDate, "00"),
            fetchDataForCalculation(moment().startOf('month').format('DD/MM/YYYY'), "00"),
            fetchDataForCalculation(moment().startOf('year').format('DD/MM/YYYY'), "00")
        ]);

        // Check if currentHourData is properly fetched
        if (!currentHourData || !currentHourData.userName || !currentHourData.product_id) {
            console.error('No valid current hour data found or required fields are missing.');
            return; // Exit if data is missing or incomplete
        }

        // Create new document for consumption data
        const newConsumptionData = new Consumption({
            userName: currentHourData.userName,
            product_id: currentHourData.product_id,
            date: currentDate,
            month:currentMonth,
            hour: currentHour,
            stacks: currentHourData.stacks.map(stack => {
                const stackName = stack.stackName;
                const findStack = (data, name) => data.stacks.find(s => s.stackName === name) || {};
                return {
                    stackName: stackName,
                    stationType: stack.stationType,
                    energyHourlyConsumption: ensureNumber(stack.energy) - ensureNumber(findStack(previousHourData, stackName).energy),
                    flowHourlyConsumption: ensureNumber(stack.cumulatingFlow) - ensureNumber(findStack(previousHourData, stackName).cumulatingFlow),
                    energyDailyConsumption: ensureNumber(stack.energy) - ensureNumber(findStack(startOfDay, stackName).energy),
                    flowDailyConsumption: ensureNumber(stack.cumulatingFlow) - ensureNumber(findStack(startOfDay, stackName).cumulatingFlow),
                    energyMonthlyConsumption: ensureNumber(stack.energy) - ensureNumber(findStack(startOfMonth, stackName).energy),
                    flowMonthlyConsumption: ensureNumber(stack.cumulatingFlow) - ensureNumber(findStack(startOfMonth, stackName).cumulatingFlow),
                    energyYearlyConsumption: ensureNumber(stack.energy) - ensureNumber(findStack(startOfYear, stackName).energy),
                    flowYearlyConsumption: ensureNumber(stack.cumulatingFlow) - ensureNumber(findStack(startOfYear, stackName).cumulatingFlow),
                };
            })
        });

        // Save the new document
        await newConsumptionData.save();
        console.log(`New consumption data saved for ${currentHourData.userName} at hour: ${currentHour} on date: ${currentDate}`);
        
        io.to(currentHourData.userName).emit('consumptionDataUpdate', {
            userName: currentHourData.userName,
            product_id: currentHourData.product_id,
            date: currentDate,
            hour: currentHour,
            stacks: newConsumptionData.stacks,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Error during consumption calculation:', error);
    }
};





//Schedule the task to calculate and save consumption data at the beginning of every hour

const setupCronJobConsumption = () => {
    // Schedule the task to run at the beginning of every hour
    cron.schedule('0 * * * *', async () => {
        console.log('Cron job triggered: saveHourlyData');
        await calculateAndSaveConsumption();
    });
};

console.log('Scheduled tasks have been initialized.');

const getConsumptionData = async (req, res) => {
    const { userName, hour, date } = req.query;

    try {
        const query = {
            userName: userName,
            date: date,
            hour: hour
        };

        // Find the consumption data that matches the userName, date, and hour
        const consumptionData = await Consumption.findOne(query);

        if (!consumptionData) {
            return res.status(404).json({ message: "No consumption data found." });
        }

        res.json(consumptionData); // Send the full document found
    } catch (error) {
        console.error('Error fetching consumption data:', error);
        res.status(500).json({ message: "Internal server error" });
    }
};
const getConsumptionDataStackName = async (req, res) => {
    const { userName, month, stackName } = req.query;

    try {
        const query = {
            userName: userName,
            month: month, // Assuming `month` is stored in a way that this direct comparison is valid
            "stacks.stackName": stackName
        };

        const consumptionData = await Consumption.findOne(query);

        if (!consumptionData) {
            return res.status(404).json({ message: "No consumption data found." });
        }

        res.json(consumptionData); // Send the full document found
    } catch (error) {
        console.error('Error fetching consumption data:', error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const getConsumptionDataByStacks = async (req, res) => {
    const { userName, stackNames, month } = req.query;
    const stackNamesArray = Array.isArray(stackNames) ? stackNames : [stackNames];

    try {
        const query = {
            userName,
            month, // Using the month directly in the query
            "stacks.stackName": { $in: stackNamesArray }
        };

        const consumptionData = await Consumption.find(query);

        if (!consumptionData.length) {
            return res.status(404).json({ message: "No matching consumption data found." });
        }

        // Map through each consumption data entry and filter stacks
        const responseData = consumptionData.map(data => ({
            userName: data.userName,
            product_id: data.product_id,
            date: data.date,
            hour: data.hour,
            month: data.month,
            stacks: data.stacks.filter(stack => stackNamesArray.includes(stack.stackName))
        }));

        res.json(responseData); // Send the array of filtered data
    } catch (error) {
        console.error('Error fetching consumption data by stacks:', error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const getLatestConsumptionData = async (req, res) => {
    const { userName } = req.query;

    try {
        const latestData = await Consumption.findOne({ userName })
                                            .sort({ date: -1, hour: -1 })
                                            .limit(1);

        if (!latestData) {
            return res.status(404).json({ message: "No latest consumption data found for this user." });
        }

        res.json(latestData);
    } catch (error) {
        console.error('Error fetching the latest consumption data:', error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const getAllConsumptionDataByUser = async (req, res) => {
    const { userName } = req.query;

    try {
        const allData = await Consumption.find({ userName });

        if (allData.length === 0) {
            return res.status(404).json({ message: "No consumption data found for this user." });
        }

        res.json(allData);
    } catch (error) {
        console.error('Error fetching all consumption data for the user:', error);
        res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = { calculateAndSaveConsumption, setupCronJobConsumption,getConsumptionData,getConsumptionDataByStacks,getConsumptionDataStackName,getLatestConsumptionData};
  