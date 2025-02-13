const MaxMinData = require('../models/MinandMax');

const moment = require('moment');

// This function should be called every hour to update the hourly max/min values
const updateMaxMinValues = async (data) => {
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

            // Retrieve the current document for this user and stack
            const existingData = await MaxandMinData.findOne({
                userName: data.userName,
                stackName,
                date: formattedDate
            });

            let maxValues = {};
            let minValues = {};
            let maxTimestamps = {};
            let minTimestamps = {};

            if (existingData) {
                maxValues = existingData.maxValues || {};
                minValues = existingData.minValues || {};
                maxTimestamps = existingData.maxTimestamps || {};
                minTimestamps = existingData.minTimestamps || {};
            } else {
                // If no document exists, create a new one
                const newData = new MaxandMinData({
                    userName: data.userName,
                    stackName,
                    date: formattedDate,
                    maxValues: {},
                    minValues: {},
                    maxTimestamps: {},
                    minTimestamps: {},
                });
                await newData.save();
                continue; // Skip updating this record; will handle in the next iteration
            }

            for (const [key, value] of Object.entries(filteredValues)) {
                if (value !== undefined && !isNaN(value)) {
                    const numValue = parseFloat(value);

                    // Update max values
                    if (!maxValues[key] || numValue > maxValues[key]) {
                        maxValues[key] = numValue;
                        maxTimestamps[key] = { date: formattedDate, time: formattedTime };
                    }

                    // Update min values
                    if (!minValues[key] || numValue < minValues[key]) {
                        minValues[key] = numValue;
                        minTimestamps[key] = { date: formattedDate, time: formattedTime };
                    }
                }
            }

            // Update the document with new max/min values and timestamps
            await MaxandMinData.updateOne(
                { userName: data.userName, stackName, date: formattedDate },
                {
                    maxValues,
                    minValues,
                    maxTimestamps,
                    minTimestamps,
                    timestamp: new Date() // Update timestamp to current
                }
            );
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
        if (!fromDate || !toDate) {
            return res.status(400).json({ message: 'fromDate and toDate are required query parameters.' });
        }

        // Format dates to match MongoDB format
        const startDateFormatted = moment(fromDate, "DD/MM/YYYY").format("DD/MM/YYYY");
        const endDateFormatted = moment(toDate, "DD/MM/YYYY").format("DD/MM/YYYY");

        // Debugging: Log the query
        const query = {
            userName,
            stackName: { $regex: new RegExp(stackName.trim(), "i") },
            date: { $gte: startDateFormatted, $lte: endDateFormatted }
        };
        console.log("MongoDB Query:", JSON.stringify(query, null, 2));

        // Fetch data from MongoDB
        const data = await MaxMinData.find(query);

        if (!data || data.length === 0) {
            return res.status(404).json({
                message: `No data found for user: ${userName}, stack: ${stackName} between ${fromDate} and ${toDate}.`
            });
        }

        res.status(200).json({
            success: true,
            message: `Data fetched successfully for user: ${userName}, stack: ${stackName} within the date range.`,
            data
        });
    } catch (error) {
        console.error("Error fetching data by date range:", error);
        res.status(500).json({
            message: "Internal Server Error while fetching data.",
            error: error.message
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
