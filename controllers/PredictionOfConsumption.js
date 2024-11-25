const Prediction = require('../models/PredictionOfConsumption');
const Consumption = require('../models/Consumption');
const moment = require('moment');
const cron = require('node-cron');
const AWS = require('aws-sdk');


// Configure AWS SDK
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

const s3 = new AWS.S3();

// Helper Function to Fetch Data from S3
const fetchDataFromS3 = async (key) => {
    try {
        console.log(`Fetching data from S3 with key: ${key}`);
        const params = {
            Bucket: 'ems-ebhoom-bucket', // Your S3 bucket name
            Key: key // File key in the bucket
        };

        const s3Object = await s3.getObject(params).promise();
        const fileContent = s3Object.Body.toString('utf-8');
        return JSON.parse(fileContent);
    } catch (error) {
        console.error('Error fetching data from S3:', error);
        throw new Error('Failed to fetch data from S3');
    }
};


// Helper function to calculate average
const calculateAverage = (data) => {
    return data.reduce((sum, item) => sum + item, 0) / (data.length || 1);
};

// Function to fetch historical data and calculate averages for both energy and flow
// Main Function to Fetch and Calculate
async function fetchDataAndCalculateAverage(dateFrom, dateTo, userName, stackName) {
    // Query MongoDB
    const data = await Consumption.find(
        {
            userName: userName,
            date: { $gte: dateFrom, $lte: dateTo },
            "stacks.stackName": stackName
        },
        'stacks.$ product_id'
    )
        .lean()
        .exec();

    // If no data found in MongoDB, fetch from S3
    if (!data.length) {
        console.log(`No data found in MongoDB for userName: ${userName}, stackName: ${stackName}, between ${dateFrom} and ${dateTo}`);
        const s3Data = await fetchDataFromS3('prediction_data/predictionData.json'); // Adjust the key as per your S3 structure
        const filteredS3Data = s3Data.filter(
            (entry) =>
                entry.userName === userName &&
                entry.stacks.some((stack) => stack.stackName === stackName) &&
                moment(entry.date, 'DD/MM/YYYY').isBetween(moment(dateFrom, 'DD/MM/YYYY'), moment(dateTo, 'DD/MM/YYYY'), null, '[]')
        );

        if (!filteredS3Data.length) {
            console.log(`No data found in S3 for userName: ${userName}, stackName: ${stackName}, between ${dateFrom} and ${dateTo}`);
            return {
                hourlyEnergyAverage: 0,
                dailyEnergyAverage: 0,
                monthlyEnergyAverage: 0,
                yearlyEnergyAverage: 0,
                hourlyFlowAverage: 0,
                dailyFlowAverage: 0,
                monthlyFlowAverage: 0,
                yearlyFlowAverage: 0,
                product_id: undefined,
                stationType: undefined
            };
        }

        // Process S3 data
        const hourlyEnergyData = filteredS3Data.map((item) => item.stacks[0].energyHourlyConsumption);
        const dailyEnergyData = filteredS3Data.map((item) => item.stacks[0].energyDailyConsumption);
        const monthlyEnergyData = filteredS3Data.map((item) => item.stacks[0].energyMonthlyConsumption);
        const yearlyEnergyData = filteredS3Data.map((item) => item.stacks[0].energyYearlyConsumption);
        const hourlyFlowData = filteredS3Data.map((item) => item.stacks[0].flowHourlyConsumption);
        const dailyFlowData = filteredS3Data.map((item) => item.stacks[0].flowDailyConsumption);
        const monthlyFlowData = filteredS3Data.map((item) => item.stacks[0].flowMonthlyConsumption);
        const yearlyFlowData = filteredS3Data.map((item) => item.stacks[0].flowYearlyConsumption);

        const validProductData = filteredS3Data.find((d) => d.product_id);

        return {
            hourlyEnergyAverage: calculateAverage(hourlyEnergyData),
            dailyEnergyAverage: calculateAverage(dailyEnergyData),
            monthlyEnergyAverage: calculateAverage(monthlyEnergyData),
            yearlyEnergyAverage: calculateAverage(yearlyEnergyData),
            hourlyFlowAverage: calculateAverage(hourlyFlowData),
            dailyFlowAverage: calculateAverage(dailyFlowData),
            monthlyFlowAverage: calculateAverage(monthlyFlowData),
            yearlyFlowAverage: calculateAverage(yearlyFlowData),
            product_id: validProductData?.product_id,
            stationType: validProductData?.stacks[0]?.stationType
        };
    }

    // Process MongoDB data
    const hourlyEnergyData = data.map((item) => item.stacks[0].energyHourlyConsumption);
    const dailyEnergyData = data.map((item) => item.stacks[0].energyDailyConsumption);
    const monthlyEnergyData = data.map((item) => item.stacks[0].energyMonthlyConsumption);
    const yearlyEnergyData = data.map((item) => item.stacks[0].energyYearlyConsumption);
    const hourlyFlowData = data.map((item) => item.stacks[0].flowHourlyConsumption);
    const dailyFlowData = data.map((item) => item.stacks[0].flowDailyConsumption);
    const monthlyFlowData = data.map((item) => item.stacks[0].flowMonthlyConsumption);
    const yearlyFlowData = data.map((item) => item.stacks[0].flowYearlyConsumption);

    const validProductData = data.find((d) => d.product_id);

    return {
        hourlyEnergyAverage: calculateAverage(hourlyEnergyData),
        dailyEnergyAverage: calculateAverage(dailyEnergyData),
        monthlyEnergyAverage: calculateAverage(monthlyEnergyData),
        yearlyEnergyAverage: calculateAverage(yearlyEnergyData),
        hourlyFlowAverage: calculateAverage(hourlyFlowData),
        dailyFlowAverage: calculateAverage(dailyFlowData),
        monthlyFlowAverage: calculateAverage(monthlyFlowData),
        yearlyFlowAverage: calculateAverage(yearlyFlowData),
        product_id: validProductData?.product_id,
        stationType: validProductData?.stacks[0]?.stationType
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
        // MongoDB Query
        const query = {
            userName,
            month,
            "stacks.stackName": stackName
        };

        const mongoData = await Prediction.findOne(query, {
            "stacks.$": 1,
            userName: 1,
            product_id: 1,
            month: 1
        }).lean();

        // Fetch S3 data
        const s3Data = await fetchDataFromS3('prediction_data/predictionData.json');
        const s3FilteredData = s3Data.filter(entry => 
            entry.userName === userName &&
            entry.month === month &&
            entry.stacks.some(stack => stack.stackName === stackName)
        );

        // Combine MongoDB and S3 data
        const combinedData = [];
        if (mongoData) {
            combinedData.push({
                userName: mongoData.userName,
                product_id: mongoData.product_id,
                month: mongoData.month,
                stack: mongoData.stacks[0]
            });
        }

        s3FilteredData.forEach(entry => {
            combinedData.push({
                userName: entry.userName,
                product_id: entry.product_id,
                month: entry.month,
                stack: entry.stacks.find(stack => stack.stackName === stackName)
            });
        });

        if (!combinedData.length) {
            return res.status(404).json({ message: "No prediction data found for the specified stack." });
        }

        res.json(combinedData);
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
        // MongoDB Query
        const query = {
            userName,
            month,
            "stacks.stackName": { $in: stackNamesArray }
        };

        const mongoData = await Prediction.find(query, {
            'stacks.$': 1,
            userName: 1,
            product_id: 1,
            month: 1,
            date: 1,
            hour: 1
        }).lean();

        // Fetch S3 data
        const s3Data = await fetchDataFromS3('prediction_data/predictionData.json');
        const s3FilteredData = s3Data.filter(entry => 
            entry.userName === userName &&
            entry.month === month &&
            entry.stacks.some(stack => stackNamesArray.includes(stack.stackName))
        );

        // Combine MongoDB and S3 data
        const combinedData = [];

        mongoData.forEach(doc => {
            combinedData.push({
                userName: doc.userName,
                product_id: doc.product_id,
                month: doc.month,
                date: doc.date,
                hour: doc.hour,
                stacks: doc.stacks.filter(stack => stackNamesArray.includes(stack.stackName))
            });
        });

        s3FilteredData.forEach(entry => {
            combinedData.push({
                userName: entry.userName,
                product_id: entry.product_id,
                month: entry.month,
                date: entry.date,
                hour: entry.hour,
                stacks: entry.stacks.filter(stack => stackNamesArray.includes(stack.stackName))
            });
        });

        if (!combinedData.length) {
            return res.status(404).json({ message: "No prediction data found for the specified stacks." });
        }

        res.json(combinedData);
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
