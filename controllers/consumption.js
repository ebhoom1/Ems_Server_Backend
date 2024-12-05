const moment = require('moment');
const HourlyData = require('../models/hourlyData');
const Consumption = require('../models/Consumption');
const cron = require('node-cron');
const AWS = require('aws-sdk');
const { io, server } = require('../app');
const moment = require('moment-timezone');


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
    cron.schedule('0 * * * *', async () => {
        const currentTimeIST = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
        console.log(`Cron job triggered: saveHourlyData at IST: ${currentTimeIST}`);
        await calculateAndSaveConsumption();
    }, {
        timezone: 'Asia/Kolkata', // Ensure the task runs in IST
    });
};

console.log('Scheduled tasks have been initialized.');

// Configure AWS SDK
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

/**
 * Fetch data from S3 bucket for consumption data.
 * @returns {Promise<Array>} - Parsed data from S3 file.
 */
const fetchConsumptionDataFromS3 = async () => {
    try {
        const key = 'consumption_data/consumptionData.json'; // Specify your S3 file key
        console.log(`Fetching data from S3 with key: ${key}`);
        const params = {
            Bucket: 'ems-ebhoom-bucket', // Your bucket name
            Key: key,
        };

        const s3Object = await s3.getObject(params).promise();
        const fileContent = s3Object.Body.toString('utf-8');

        // Parse JSON content
        const jsonData = JSON.parse(fileContent);

        console.log("Fetched S3 Data Length:", jsonData.length);

        return jsonData;
    } catch (error) {
        console.error('Error fetching data from S3:', error);
        throw new Error('Failed to fetch data from S3');
    }
};

const getConsumptionData = async (req, res) => {
    const { userName, hour, date } = req.query;

    try {
        // Query MongoDB for consumption data
        const query = { userName, date, hour };
        const consumptionData = await Consumption.findOne(query);

        if (!consumptionData) {
            console.log("No data found in MongoDB. Fetching from S3...");

            // Fetch data from S3
            const s3Data = await fetchConsumptionDataFromS3();

            // Filter S3 data
            const filteredS3Data = s3Data.find(entry => entry.userName === userName && entry.date === date && entry.hour === hour);

            if (!filteredS3Data) {
                return res.status(404).json({ message: "No consumption data found." });
            }

            return res.json(filteredS3Data);
        }

        res.json(consumptionData); // Send the full document found in MongoDB
    } catch (error) {
        console.error('Error fetching consumption data:', error);
        res.status(500).json({ message: "Internal server error" });
    }
};
const getConsumptionDataStackName = async (req, res) => {
    const { userName, month, stackName } = req.query;

    try {
        // Query MongoDB for consumption data
        const query = {
            userName,
            month,
            "stacks.stackName": stackName,
        };
        const consumptionData = await Consumption.findOne(query);

        if (!consumptionData) {
            console.log("No data found in MongoDB. Fetching from S3...");

            // Fetch data from S3
            const s3Data = await fetchConsumptionDataFromS3();

            // Filter S3 data
            const filteredS3Data = s3Data.find(entry =>
                entry.userName === userName &&
                entry.month === month &&
                entry.stacks.some(stack => stack.stackName === stackName)
            );

            if (!filteredS3Data) {
                return res.status(404).json({ message: "No consumption data found." });
            }

            return res.json(filteredS3Data);
        }

        res.json(consumptionData); // Send the full document found in MongoDB
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

        // First, try fetching from MongoDB
        const consumptionData = await Consumption.find(query);

        if (!consumptionData.length) {
            console.log('No data found in MongoDB. Fetching from S3...');

            // If no data found in MongoDB, fetch data from S3
            const s3Data = await fetchConsumptionDataFromS3();

            // Filter the S3 data based on userName, stackNames, and month
            const filteredS3Data = s3Data.filter(entry => 
                entry.userName === userName &&
                entry.month === month &&
                entry.stacks.some(stack => stackNamesArray.includes(stack.stackName))
            );

            if (filteredS3Data.length === 0) {
                return res.status(404).json({ message: "No matching consumption data found." });
            }

            // Filter the stacks to only include the ones that match the requested stack names
            const responseData = filteredS3Data.map(data => ({
                userName: data.userName,
                product_id: data.product_id,
                date: data.date,
                hour: data.hour,
                month: data.month,
                stacks: data.stacks.filter(stack => stackNamesArray.includes(stack.stackName))
            }));

            return res.json(responseData); // Send the filtered data from S3
        }

        // If MongoDB has data, filter the stacks based on stack names
        const responseData = consumptionData.map(data => ({
            userName: data.userName,
            product_id: data.product_id,
            date: data.date,
            hour: data.hour,
            month: data.month,
            stacks: data.stacks.filter(stack => stackNamesArray.includes(stack.stackName))
        }));

        res.json(responseData); // Send the filtered data from MongoDB

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
            console.log('No data found in MongoDB. Fetching from S3...');

            // If no data is found in MongoDB, fetch from S3
            const s3Data = await fetchConsumptionDataFromS3();

            // Filter data from S3 based on userName
            const filteredS3Data = s3Data.find(entry => entry.userName === userName);

            if (!filteredS3Data) {
                return res.status(404).json({ message: "No latest consumption data found for this user." });
            }

            return res.json(filteredS3Data); // Send the latest data from S3
        }

        res.json(latestData); // Send the latest data from MongoDB

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
  