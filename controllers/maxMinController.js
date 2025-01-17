const MaxandMinData = require('../models/MinandMax');
const moment = require('moment-timezone'); // Import moment-timezone for timezone handling


// This function should be called every hour to update the hourly max/min values
const updateMaxMinValues  = async (data) => {
    try {
        if (!Array.isArray(data.stackData)) {
            console.error('stackData is not an array or is undefined:', data.stackData);
            return;
        }

        const formattedDate = moment().tz('Asia/Kolkata').format('DD/MM/YYYY');
        const formattedTime = moment().tz('Asia/Kolkata').format('HH:mm A'); // 24-hour format with AM/PM

        for (const stack of data.stackData) {
            const { stackName, ...values } = stack;

            // Filter out 'Turbidity' and 'pH'
            const filteredValues = Object.fromEntries(
                Object.entries(values).filter(
                    ([key]) => key !== 'Turbidity' && key !== 'pH'
                )
            );

            const startOfHour = moment().tz('Asia/Kolkata').startOf('hour').toDate();
            const endOfHour = moment().tz('Asia/Kolkata').endOf('hour').toDate();

            // Query to find if there is already an entry for this hour
            let existingData = await MaxandMinData.findOne({
                userName: data.userName,
                stackName: stackName,
                timestamp: { $gte: startOfHour, $lte: endOfHour }
            });

            if (!existingData) {
                // If no data exists for this hour, create a new record
                existingData = new MaxandMinData({
                    userName: data.userName,
                    stackName,
                    date: formattedDate,
                    maxValues: {},
                    minValues: {},
                    maxTimestamps: {},
                    minTimestamps: {},
                    timestamp: new Date()  // setting the timestamp to the current time
                });
            }

            for (const [key, value] of Object.entries(filteredValues)) {
                if (value !== undefined && !isNaN(value)) {
                    const numValue = parseFloat(value);
                    // Update max values and timestamps
                    if (!existingData.maxValues[key] || numValue > existingData.maxValues[key]) {
                        existingData.maxValues[key] = numValue;
                        existingData.maxTimestamps[key] = { date: formattedDate, time: formattedTime };
                    }

                    // Update min values and timestamps
                    if (!existingData.minValues[key] || numValue < existingData.minValues[key]) {
                        existingData.minValues[key] = numValue;
                        existingData.minTimestamps[key] = { date: formattedDate, time: formattedTime };
                    }
                }
            }

            await existingData.save();
        }
    } catch (error) {
        console.error('Error updating max/min hourly values:', error);
    }
};


const getMaxMinDataByUserAndStack = async (userName, stackName) => {
    try {
        const data = await MaxMinData.findOne({ userName, stackName });
        if (!data) {
            return { success: false, message: `No data found for user: ${userName} and stack: ${stackName}` };
        }
        return { success: true, data };
    } catch (error) {
        console.error('Error fetching max/min data by user and stack:', error);
        return { success: false, message: 'Error fetching data', error: error.message };
    }
};

const getMaxMinDataByUser = async (userName) => {
    try {
        const data = await MaxMinData.find({ userName });
        if (!data || data.length === 0) {
            return { success: false, message: `No data found for user: ${userName}` };
        }
        return { success: true, data };
    } catch (error) {
        console.error('Error fetching max/min data by user:', error);
        return { success: false, message: 'Error fetching data', error: error.message };
    }
};
const getMaxMinDataByDateRange = async (req, res) => {
    const { userName, stackName } = req.params;
    const { fromDate, toDate } = req.query;

    try {
        // Validate and parse dates
        if (!fromDate || !toDate) {
            return res.status(400).json({ message: 'fromDate and toDate are required query parameters.' });
        }

        const startDate = moment(fromDate, 'DD-MM-YYYY', true).startOf('day');
        const endDate = moment(toDate, 'DD-MM-YYYY', true).endOf('day');

        if (!startDate.isValid() || !endDate.isValid()) {
            return res.status(400).json({ message: 'Invalid date format. Use DD-MM-YYYY.' });
        }

        // Query the database for matching records
        const data = await MaxMinData.find({
            userName,
            stackName,
            timestamp: { $gte: startDate.toDate(), $lte: endDate.toDate() },
        });

        if (!data || data.length === 0) {
            return res.status(404).json({
                message: `No data found for user: ${userName}, stack: ${stackName} between ${fromDate} and ${toDate}.`,
            });
        }

        // Return the result
        res.status(200).json({
            success: true,
            message: `Data fetched successfully for user: ${userName}, stack: ${stackName} within the date range.`,
            data,
        });
    } catch (error) {
        console.error('Error fetching data by date range:', error);
        res.status(500).json({
            message: 'Internal Server Error while fetching data.',
            error: error.message,
        });
    }
};
const saveDailyMinMaxValues = async (data) => {
    try {
        if (!Array.isArray(data.stackData)) {
            console.error('stackData is not an array or is undefined:', data.stackData);
            return;
        }

        const formattedDate = moment().tz('Asia/Kolkata').format('DD/MM/YYYY');
        const formattedTime = moment().tz('Asia/Kolkata').format('hh:mm A'); // 12-hour format with AM/PM

        for (const stack of data.stackData) {
            const { stackName, ...values } = stack;

            // Filter out unwanted fields
            const filteredValues = Object.fromEntries(
                Object.entries(values).filter(([key]) => key !== 'Turbidity' && key !== 'pH')
            );

            // Query to check if data for the day exists
            let existingData = await MaxandMinData.findOne({
                userName: data.userName,
                stackName,
                date: formattedDate,
            });

            if (!existingData) {
                // Create a new entry if data for the day doesn't exist
                existingData = new MaxandMinData({
                    userName: data.userName,
                    stackName,
                    date: formattedDate,
                    maxValues: {},
                    minValues: {},
                    maxTimestamps: {},
                    minTimestamps: {},
                });
            }

            let updatedMaxHistory = existingData.maxTimestamps || {};
            let updatedMinHistory = existingData.minTimestamps || {};

            for (const [key, value] of Object.entries(filteredValues)) {
                if (value !== undefined && !isNaN(value)) {
                    const numValue = parseFloat(value);

                    // Update max values and timestamps for the day
                    if (!existingData.maxValues[key] || numValue > existingData.maxValues[key]) {
                        existingData.maxValues[key] = numValue;

                        if (!updatedMaxHistory[key]) {
                            updatedMaxHistory[key] = [];
                        }

                        updatedMaxHistory[key].push({
                            value: numValue,
                            date: formattedDate,
                            time: formattedTime,
                        });
                    }

                    // Update min values and timestamps for the day
                    if (!existingData.minValues[key] || numValue < existingData.minValues[key]) {
                        existingData.minValues[key] = numValue;

                        if (!updatedMinHistory[key]) {
                            updatedMinHistory[key] = [];
                        }

                        updatedMinHistory[key].push({
                            value: numValue,
                            date: formattedDate,
                            time: formattedTime,
                        });
                    }
                }
            }

            // Save the updated data for the day
            existingData.maxTimestamps = updatedMaxHistory;
            existingData.minTimestamps = updatedMinHistory;

            await existingData.save();
        }
    } catch (error) {
        console.error('Error saving daily min/max values:', error);
    }
};

module.exports = { updateMaxMinValues,getMaxMinDataByUserAndStack,getMaxMinDataByUser, getMaxMinDataByDateRange,saveDailyMinMaxValues };
