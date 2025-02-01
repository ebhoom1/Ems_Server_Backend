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
    try {
        const result = await HourlyData.findOne({ date: date, hour: String(hour) });
        if (!result) {
            console.warn(`⚠️ No data found for Date: ${date}, Hour: ${hour}`);
            return { stacks: [], userName: '', product_id: '' };
        }
        return result;
    } catch (error) {
        console.error(`Error fetching data for Date: ${date}, Hour: ${hour}`, error);
        return { stacks: [], userName: '', product_id: '' };
    }
};

const calculateAndSaveConsumption = async () => {
    const now = moment().subtract(1, 'hours');
    const currentHour = now.format('HH');
    const currentDate = now.format('DD/MM/YYYY');
    const currentMonth = now.format('MM');

    console.log(`⚡ Fetching data for current hour: ${currentHour}, Date: ${currentDate}`);

    try {
        const [currentHourData, previousHourData] = await Promise.all([
            fetchDataForCalculation(currentDate, currentHour),
            fetchDataForCalculation(currentDate, String(Number(currentHour) - 1))
        ]);

        if (!currentHourData || !currentHourData.stacks.length) {
            console.warn(`⚠️ No valid current hour data found for ${currentDate} at hour ${currentHour}.`);
            return;
        }

        const getStackValue = (data, stackName, key) => {
            if (!data || !Array.isArray(data.stacks)) return 0;
            const stack = data.stacks.find(s => s.stackName === stackName);
            return stack && typeof stack[key] === 'number' ? stack[key] : 0;
        };

        const newConsumptionData = new Consumption({
            userName: currentHourData.userName,
            product_id: currentHourData.product_id,
            date: currentDate,
            month: currentMonth,
            hour: currentHour,
            stacks: currentHourData.stacks.map(stack => ({
                stackName: stack.stackName,
                stationType: stack.stationType,
                energyHourlyConsumption: getStackValue(currentHourData, stack.stackName, 'energy') - getStackValue(previousHourData, stack.stackName, 'energy'),
                flowHourlyConsumption: getStackValue(currentHourData, stack.stackName, 'cumulatingFlow') - getStackValue(previousHourData, stack.stackName, 'cumulatingFlow'),
            }))
        });

        await newConsumptionData.save();
        console.log(`✅ New consumption data saved for ${currentHourData.userName} at hour: ${currentHour} on date: ${currentDate}`);

    } catch (error) {
        console.error('❌ Error during consumption calculation:', error);
    }
};









//Schedule the task to calculate and save consumption data at the beginning of every hour


const setupCronJobConsumption =() => {
    cron.schedule('0 * * * *', async () => {
        console.log('Running hourly consumption calculation from S3...');
        await calculateAndSaveConsumption();
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
const getConsumptionDataByDateRange = async (req, res) => {
    const { userName, fromDate, toDate } = req.query;

    try {
        // Validate required parameters
        if (!userName || !fromDate || !toDate) {
            return res.status(400).json({ message: "Missing required query parameters: userName, fromDate, or toDate." });
        }

        const startIST = moment.tz(fromDate, 'DD-MM-YYYY', 'Asia/Kolkata').startOf('day').toDate();
        const endIST = moment.tz(toDate, 'DD-MM-YYYY', 'Asia/Kolkata').endOf('day').toDate();

        if (isNaN(startIST) || isNaN(endIST)) {
            return res.status(400).json({ message: "Invalid date format. Use 'DD-MM-YYYY'." });
        }

        // Fetch data from MongoDB
        const mongoData = await Consumption.find({
            userName,
            timestamp: { $gte: startIST, $lte: endIST },
        }).lean();

        console.log(`Fetched ${mongoData.length} records from MongoDB.`);

        // Fetch data from S3
        const s3Data = await fetchConsumptionDataFromS3();
        const filteredS3Data = s3Data.filter(entry => {
            const entryDate = moment(entry.date, 'DD/MM/YYYY').toDate();
            return (
                entry.userName === userName &&
                entryDate >= startIST &&
                entryDate <= endIST
            );
        });

        console.log(`Fetched ${filteredS3Data.length} records from S3.`);

        // Combine MongoDB and S3 data
        const combinedData = [...mongoData, ...filteredS3Data];

        // Sort combined data by date and hour
        combinedData.sort((a, b) => {
            const dateA = moment(a.date, 'DD/MM/YYYY').toDate();
            const dateB = moment(b.date, 'DD/MM/YYYY').toDate();
            if (dateA.getTime() === dateB.getTime()) {
                return parseInt(a.hour, 10) - parseInt(b.hour, 10);
            }
            return dateA - dateB;
        });

        if (combinedData.length === 0) {
            return res.status(404).json({ message: "No consumption data found for the specified range." });
        }

        res.json({
            message: "Consumption data fetched successfully.",
            data: combinedData,
        });
    } catch (error) {
        console.error("Error fetching consumption data by date range:", error);
        res.status(500).json({ message: "Internal server error.", error: error.message });
    }
};

const getTodayConsumptionData = async (req, res) => {
    const { userName } = req.query;

    try {
        if (!userName) {
            return res.status(400).json({ message: "Missing required query parameter: userName." });
        }

        const today = moment().format('DD/MM/YYYY');
        const todayData = await Consumption.find({ userName, date: today }).sort({ hour: -1 }).limit(1);

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

const getConsumptionDataFromMongo = async (req, res) => {
    const { userName, stackName, date } = req.query;

    try {
        if (!userName || !stackName || !date) {
            return res.status(400).json({ message: "Missing required query parameters: userName, stackName, or date." });
        }

        // Convert date format from "DD-MM-YYYY" to "DD/MM/YYYY"
        const formattedDate = date.replace(/-/g, "/");

        // Define the query object (excluding hour to get the latest entry for the date)
        const query = {
            userName,
            date: formattedDate,
            "stacks.stackName": stackName
        };

        console.log("Querying MongoDB with:", query);

        // Fetch the latest entry for the given user, stackName, and date, sorted by hour descending
        let mongoData = await Consumption.find(query).sort({ hour: -1 }).limit(1);

        if (mongoData.length > 0) {
            const filteredMongoData = mongoData.map(data => ({
                userName: data.userName,
                product_id: data.product_id,
                date: data.date,
                hour: data.hour, // This will return the last saved hour
                stacks: data.stacks.filter(stack => stack.stackName === stackName)
            }));

            return res.json({ message: "Latest consumption data fetched successfully from MongoDB.", data: filteredMongoData });
        }

        return res.status(404).json({ message: "No matching consumption data found in MongoDB." });
    } catch (error) {
        console.error('Error fetching consumption data:', error);
        res.status(500).json({ message: "Internal server error.", error: error.message });
    }
};





module.exports = { calculateAndSaveConsumption,getTodayConsumptionData,getConsumptionDataFromMongo, setupCronJobConsumption,getConsumptionData,getConsumptionDataByStacks,getConsumptionDataStackName,getLatestConsumptionData,getConsumptionDataByDateRange};