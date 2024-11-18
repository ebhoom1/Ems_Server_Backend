const ConsumptionData = require('../models/ConsumptionData');
const PredictionData = require('../models/PredictionData');
const IotData = require('../models/iotData'); 
const moment = require('moment-timezone');
const cron = require('node-cron'); 

// Helper function to calculate average consumption per stack
const calculateAveragePerStack = async (userName, product_id, startTime, endTime) => {
    const data = await ConsumptionData.aggregate([
        {
            $match: {
                userName,
                product_id,
                timestamp: { $gte: startTime, $lt: endTime }
            }
        },
        { $unwind: '$totalConsumptionData' },
        {
            $group: {
                _id: '$totalConsumptionData.stackName',
                stationType: { $first: '$totalConsumptionData.stationType' },
                predictedInflow: { $avg: '$totalConsumptionData.inflow' },
                predictedFinalflow: { $avg: '$totalConsumptionData.finalflow' },
                predictedEnergy: { $avg: '$totalConsumptionData.energy' }
            }
        }
    ]);
    return data;
};

// Function to generate and save predictions
const generateAndSavePredictions = async (userName, product_id, predictionType) => {
    try {
        const { startTime, endTime } = getStartAndEndTime(predictionType);
        const averageData = await calculateAveragePerStack(userName, product_id, startTime, endTime);

        if (averageData.length === 0) {
            console.log(`No data available for ${userName} - ${predictionType}`);
            return;
        }

        const predictionEntry = new PredictionData({
            userName,
            product_id,
            predictionType,
            timestamp: new Date(),
            predictionData: averageData.map(stack => ({
                stackName: stack._id,
                stationType: stack.stationType || 'NIL',
                predictedInflow: stack.predictedInflow || 0,
                predictedFinalflow: stack.predictedFinalflow || 0,
                predictedEnergy: stack.predictedEnergy || 0
            }))
        });

        await predictionEntry.save();
        //console.log(`Prediction saved for ${userName} - ${predictionType}`);
    } catch (error) {
        console.error(`Error generating predictions for ${userName} - ${predictionType}:`, error);
    }
};

// Function to run predictions for all users/products
const runPredictionCalculation = async (predictionType) => {
    try {
        const users = await ConsumptionData.distinct('userName');
        for (const userName of users) {
            const productIds = await ConsumptionData.distinct('product_id', { userName });
            await Promise.all(
                productIds.map(product_id => generateAndSavePredictions(userName, product_id, predictionType))
            );
        }
    } catch (error) {
        console.error(`Error running ${predictionType} prediction calculation:`, error);
    }
};

// Helper to get the start and end time based on the interval type
const getStartAndEndTime = (intervalType) => {
    const endTime = moment().utc();
    const startTime = {
        hourly: endTime.clone().subtract(1, 'hour'),
        daily: endTime.clone().subtract(1, 'day'),
        monthly: endTime.clone().subtract(1, 'month')
    }[intervalType];

    return { startTime: startTime.toDate(), endTime: endTime.toDate() };
};

// Generic function to schedule tasks
const scheduleTask = (cronTime, calculationFn, intervalType) => {
    cron.schedule(cronTime, async () => {
        //console.log(`Running ${intervalType} calculation...`);
        try {
            await calculationFn(intervalType);
        } catch (error) {
            console.error(`Error during ${intervalType} calculation:`, error);
        }
    });
};

// Schedule both predictions and consumption calculations
const schedulePredictionCalculation = () => {
    const intervals = [
        { cronTime: '0 * * * *', predictionType: 'hourly' },  // Hourly
        { cronTime: '0 0 * * *', predictionType: 'daily' },   // Daily
        { cronTime: '0 0 1 * *', predictionType: 'monthly' }  // Monthly
    ];

    intervals.forEach(({ cronTime, predictionType }) => {
        scheduleTask(cronTime, runPredictionCalculation, predictionType);
    });
};

// Get all prediction data
const getAllPredictionData = async (req, res) => {
    try {
        const data = await PredictionData.find();
        if (!data.length) {
            return res.status(404).json({ message: 'No prediction data available.' });
        }
        res.status(200).json(data);
    } catch (error) {
        console.error('Error fetching all prediction data:', error);
        res.status(500).json({ message: 'Internal server error.', error });
    }
};

// Get prediction data by userName
const getPredictionDataByUserName = async (req, res) => {
    const { userName } = req.params;
    try {
        const data = await PredictionData.find({ userName });
        if (!data.length) {
            return res.status(404).json({ message: `No prediction data found for user ${userName}.` });
        }
        res.status(200).json(data);
    } catch (error) {
        console.error(`Error fetching data for user ${userName}:`, error);
        res.status(500).json({ message: 'Internal server error.', error });
    }
};

// Get prediction data by userName and stackName
const getPredictionDataByUserNameAndStackName = async (req, res) => {
    const { userName, stackName } = req.params;
    try {
        const data = await PredictionData.find({
            userName,
            'predictionData.stackName': stackName,
        });

        if (!data.length) {
            return res.status(404).json({ message: 'No prediction data found for the specified user and stack.' });
        }

        const filteredData = data.map(entry => ({
            ...entry._doc,
            predictionData: entry.predictionData.filter(stack => stack.stackName === stackName),
        }));

        res.status(200).json(filteredData);
    } catch (error) {
        console.error(`Error fetching data for user ${userName} and stack ${stackName}:`, error);
        res.status(500).json({ message: 'Internal server error.', error });
    }
};

// Get prediction data by userName, stackName, and predictionType
const getPredictionDataByUserNameAndStackNameAndInterval = async (req, res) => {
    const { userName, stackName, predictionType } = req.params;

    try {
        const data = await PredictionData.find({
            userName,
            predictionType,
            'predictionData.stackName': stackName,
        });

        if (!data.length) {
            return res.status(404).json({
                message: 'No prediction data found for the specified user, stack, and prediction Type.',
            });
        }

        const filteredData = data.map(entry => ({
            ...entry._doc,
            predictionData: entry.predictionData.filter(stack => stack.stackName === stackName),
        }));

        res.status(200).json(filteredData);
    } catch (error) {
        console.error(
            `Error fetching data for user ${userName}, stack ${stackName}, and interval type ${predictionType}:`,
            error
        );
        res.status(500).json({ message: 'Internal server error.', error });
    }
};


module.exports = { 
    generateAndSavePredictions,
    runPredictionCalculation, 
    schedulePredictionCalculation,
    getAllPredictionData,
    getPredictionDataByUserName,
    getPredictionDataByUserNameAndStackName,
    getPredictionDataByUserNameAndStackNameAndInterval,
};



