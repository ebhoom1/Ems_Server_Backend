const Prediction = require('../models/PredictionOfConsumption');
const Consumption = require('../models/Consumption');
const moment = require('moment');
const cron = require('node-cron');

// Helper function to calculate average
const calculateAverage = (data) => {
    return data.reduce((sum, item) => sum + item, 0) / (data.length || 1);
};

// Function to fetch historical data and calculate averages for both energy and flow
async function fetchDataAndCalculateAverage(dateFrom, dateTo, userName, stackName) {
    const data = await Consumption.find({
        userName: userName,
        date: { $gte: dateFrom, $lte: dateTo },
        "stacks.stackName": stackName,
    }, 'stacks.$ product_id').lean().exec();

    if (!data.length) {
        console.log(`No data found for userName: ${userName}, stackName: ${stackName}, between ${dateFrom} and ${dateTo}`);
        return { 
            hourlyEnergyAverage: 0, dailyEnergyAverage: 0, monthlyEnergyAverage: 0, yearlyEnergyAverage: 0,
            hourlyFlowAverage: 0, dailyFlowAverage: 0, monthlyFlowAverage: 0, yearlyFlowAverage: 0,
            product_id: undefined, stationType: undefined
        };
    }

    const hourlyEnergyData = data.map(item => item.stacks[0].energyHourlyConsumption);
    const dailyEnergyData = data.map(item => item.stacks[0].energyDailyConsumption);
    const monthlyEnergyData = data.map(item => item.stacks[0].energyMonthlyConsumption);
    const yearlyEnergyData = data.map(item => item.stacks[0].energyYearlyConsumption);
    const hourlyFlowData = data.map(item => item.stacks[0].flowHourlyConsumption);
    const dailyFlowData = data.map(item => item.stacks[0].flowDailyConsumption);
    const monthlyFlowData = data.map(item => item.stacks[0].flowMonthlyConsumption);
    const yearlyFlowData = data.map(item => item.stacks[0].flowYearlyConsumption);

    const validProductData = data.find(d => d.product_id); // Find the first entry with a valid product_id

    return {
        hourlyEnergyAverage: calculateAverage(hourlyEnergyData),
        dailyEnergyAverage: calculateAverage(dailyEnergyData),
        monthlyEnergyAverage: calculateAverage(monthlyEnergyData),
        yearlyEnergyAverage: calculateAverage(yearlyEnergyData),
        hourlyFlowAverage: calculateAverage(hourlyFlowData),
        dailyFlowAverage: calculateAverage(dailyFlowData),
        monthlyFlowAverage: calculateAverage(monthlyFlowData),
        yearlyFlowAverage: calculateAverage(yearlyFlowData),
        // product_id: validProductData.product_id,
        stationType: validProductData.stacks[0].stationType // Assuming stationType is consistent and valid
    };
}

// Function to calculate predictions for all users and aggregate stacks into one document per user
async function calculatePredictions() {
    const today = moment().format('DD/MM/YYYY');
    const yesterday = moment().subtract(1, 'days').format('DD/MM/YYYY');

    const allUsers = await Consumption.distinct("userName");

    for (const userName of allUsers) {
        const stacks = await Consumption.distinct("stacks.stackName", { userName: userName });
        const stackData = [];

        for (const stackName of stacks) {
            const predictions = await fetchDataAndCalculateAverage(yesterday, today, userName, stackName);
            stackData.push({
                stackName: stackName,
                stationType: predictions.stationType,
                energyHourlyPrediction: predictions.hourlyEnergyAverage,
                flowHourlyPrediction: predictions.hourlyFlowAverage,
                energyDailyPrediction: predictions.dailyEnergyAverage,
                flowDailyPrediction: predictions.dailyFlowAverage,
                energyMonthlyPrediction: predictions.monthlyEnergyAverage,
                flowMonthlyPrediction: predictions.monthlyFlowAverage,
                energyYearlyPrediction: predictions.yearlyEnergyAverage,
                flowYearlyPrediction: predictions.yearlyFlowAverage
            });
        }

        const newPrediction = new Prediction({
            userName: userName,
            product_id: stackData[0].product_id, // Assuming all stacks for a user have the same product_id
            date: today,
            hour: moment().format('HH'),
            month:moment().format('MM'),
            stacks: stackData
        });

        await newPrediction.save();
        console.log(`Predictions saved for ${userName} on date: ${today}`);
    }
}




const setupCronJobPrediction = () => {
    // Schedule the prediction calculation to run every hour
cron.schedule('0 * * * *', async () => {
    console.log('Cron job triggered: Calculate hourly predictions for all users and stacks');
    await calculatePredictions();
});
};

// Function to fetch and return prediction data for a given userName, date, hour, and stackName
const getPredictionDataByStack = async (req, res) => {
    const { userName, month, stackName } = req.query;

    try {
        const query = {
            userName,
            month, // Using month instead of date and hour
            "stacks.stackName": stackName
        };

        const predictionData = await Prediction.findOne(query, {
            "stacks.$": 1,
            userName: 1,
            product_id: 1,
            month: 1
        });

        if (!predictionData) {
            return res.status(404).json({ message: "No prediction data found for the specified stack." });
        }

        res.json({
            userName: predictionData.userName,
            product_id: predictionData.product_id,
            month: predictionData.month,
            stack: predictionData.stacks[0]  // "$" operator returns only the matching stack
        });
    } catch (error) {
        console.error('Error fetching prediction data:', error);
        res.status(500).json({ message: "Internal server error" });
    }
};


// Function to fetch and return prediction data for a given userName, date, hour, and multiple stackNames
const getPredictionDataByMultipleStacks = async (req, res) => {
    const { userName, stackNames, month } = req.query;
    const stackNamesArray = Array.isArray(stackNames) ? stackNames : [stackNames];

    try {
        const query = {
            userName,
            month, // Using month directly in the query
            "stacks.stackName": { $in: stackNamesArray }
        };

        const predictionData = await Prediction.find(query, {
            'stacks.$': 1, // This returns only the matched subdocuments within the 'stacks' array
            userName: 1,
            product_id: 1,
            month: 1,
            date: 1,  // Assuming 'date' is a field at the same level as 'month'
            hour: 1   // Assuming 'hour' is also at the same level as 'month'
        }).lean();

        if (!predictionData.length) {
            return res.status(404).json({ message: "No prediction data found for the specified stacks." });
        }

        const responseData = predictionData.map(doc => ({
            userName: doc.userName,
            product_id: doc.product_id,
            month: doc.month,
            date:doc.date,
            hour:doc.hour,
            stacks: doc.stacks.filter(stack => stackNamesArray.includes(stack.stackName))  // filter only the requested stacks
        }));

        res.json(responseData);
    } catch (error) {
        console.error('Error fetching prediction data by stacks:', error);
        res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = {
    calculatePredictions,
    setupCronJobPrediction,
    getPredictionDataByStack,
    getPredictionDataByMultipleStacks

};
