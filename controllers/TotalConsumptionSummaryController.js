
const Consumption = require('../models/Consumption');
const TotalConsumptionSummary = require('../models/TotalConsumptionSummary');
const moment = require('moment-timezone');
const cron = require('node-cron');
const HourlyData = require('../models/hourlyData');
const User = require('../models/user');



// Helper function to fetch user details
const fetchUserDetails = async (userName) => {
    return await User.findOne({ userName }).lean();
};

// Function to calculate and save total consumption summary for the last entry
const calculateTotalConsumptionFromLastEntry = async () => {
    const users = await HourlyData.distinct("userName");
    for (const userName of users) {
        const latestData = await HourlyData.findOne({ userName }).sort({ date: -1, hour: -1 }).exec();
        if (!latestData) {
            console.log(`No data found for user ${userName}`);
            return;
        }

        const userDetails = await fetchUserDetails(userName);
        if (!userDetails) {
            console.log(`User details not found for ${userName}`);
            return;
        }

        let totalEnergy = 0;
        let totalCumulatingFlow = 0;
        latestData.stacks.forEach(stack => {
            totalEnergy += stack.energy || 0;
            totalCumulatingFlow += stack.cumulatingFlow || 0;
        });

        const intervalType = 'hourly';
        const interval = moment().subtract(1, 'hours').format('DD/MM/YYYY HH:mm:ss ddd');
        const date = moment().format('DD/MM/YYYY');

        const summaryEntry = new TotalConsumptionSummary({
            userName: userName,
            product_id: latestData.product_id,
            companyName: userDetails.companyName,
            email: userDetails.email,
            mobileNumber: userDetails.mobileNumber,
            interval: interval,
            intervalType: intervalType,
            totalEnergy: totalEnergy,
            totalCumulatingFlow: totalCumulatingFlow,
            date: date
        });

        await summaryEntry.save();
        console.log(`Total consumption summary saved for ${userName}: Energy=${totalEnergy}, Flow=${totalCumulatingFlow}`);
    }
};


const setupCronJobTotalSummary = () => {
   // Schedule the summary calculation to run every hour on the hour
cron.schedule('0 * * * *', () => {
    console.log('Running hourly total consumption summary calculation...');
    calculateTotalConsumptionFromLastEntry();
});
};
// Get all total consumption summaries
const getAllSummary = async (req, res) => {
    try {
        const data = await TotalConsumptionSummary.find();
        if (!data.length) {
            return res.status(404).json({ message: 'No summary data available.' });
        }
        res.status(200).json(data);
    } catch (error) {
        console.error('Error fetching all summary data:', error);
        res.status(500).json({ message: 'Internal server error.', error });
    }
};

// Get total consumption summary by userName
const getSummaryByUserName = async (req, res) => {
    const { userName } = req.params;
    try {
        const data = await TotalConsumptionSummary.findOne({ userName })
                                                  .sort({ createdAt: -1 }); // Sorts by `createdAt` in descending order, ensuring the newest document is first.
        if (!data) {
            return res.status(404).json({ message: `No summary data found for user ${userName}.` });
        }
        res.status(200).json(data);
    } catch (error) {
        console.error(`Error fetching summary data for user ${userName}:`, error);
        res.status(500).json({ message: 'Internal server error.', error });
    }
};


// Get total consumption summary by userName and intervalType
const getSummaryByUserNameAndInterval = async (req, res) => {
    const { userName, intervalType } = req.params;

    try {
        const data = await TotalConsumptionSummary.find({
            userName,
            intervalType,
        });

        if (!data.length) {
            return res.status(404).json({
                message: 'No summary data found for the specified user and interval type.',
            });
        }

        res.status(200).json(data);
    } catch (error) {
        console.error(
            `Error fetching summary data for user ${userName} and interval type ${intervalType}:`,
            error
        );
        res.status(500).json({ message: 'Internal server error.', error });
    }
};

module.exports = { 
    // scheduleTotalConsumptionSummaryCalculation, 
    //calculateTotalConsumptionSummary, 
    setupCronJobTotalSummary,
    getAllSummary,
    getSummaryByUserName,
    getSummaryByUserNameAndInterval,
};
