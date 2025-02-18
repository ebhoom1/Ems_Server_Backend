const MaxMinData = require('../models/MinandMax');

const moment = require('moment');

// This function should be called every hour to update the hourly max/min values


const updateMaxMinValues = async (data) => {
    try {
        if (!Array.isArray(data.stackData)) {
            console.error('❌ stackData is not an array or is undefined:', data.stackData);
            return;
        }

        const formattedDate = moment().tz('Asia/Kolkata').format('DD/MM/YYYY');
        const formattedTime = moment().tz('Asia/Kolkata').format('HH:mm A');

        for (const stack of data.stackData) {
            const { stackName, stationType, ...values } = stack;

            // ✅ Only save if stationType is "effluent"
            if (stationType !== 'effluent') {
                console.log(`⚠️ Skipping stack ${stackName}, stationType is not effluent.`);
                continue;
            }

            const filteredValues = Object.fromEntries(
                Object.entries(values).filter(([key]) => key !== 'Turbidity' && key !== 'pH')
            );

            // 🔹 **Find existing document for today**
            let existingData = await MaxMinData.findOne({
                userName: data.userName,
                stackName,
                date: formattedDate,
            });

            if (!existingData) {
                console.log(`📌 No Min/Max data found for ${stackName} on ${formattedDate}, creating a new entry.`);

                // ✅ **Create new document with first received values as min/max**
                existingData = new MaxMinData({
                    userName: data.userName,
                    stackName,
                    date: formattedDate,
                    maxValues: {},
                    minValues: {},
                    maxTimestamps: {},
                    minTimestamps: {},
                });

                for (const [key, value] of Object.entries(filteredValues)) {
                    if (value !== undefined && !isNaN(value)) {
                        const numValue = parseFloat(value);
                        existingData.maxValues[key] = numValue;
                        existingData.minValues[key] = numValue;
                        existingData.maxTimestamps[key] = [{ date: formattedDate, time: formattedTime }];
                        existingData.minTimestamps[key] = [{ date: formattedDate, time: formattedTime }];
                    }
                }

                await existingData.save();
                console.log(`✅ New document created for ${stackName}`);
                continue;
            }

            // 🔹 **Ensure fields exist before updating**
            existingData.maxValues = existingData.maxValues || {};
            existingData.minValues = existingData.minValues || {};
            existingData.maxTimestamps = existingData.maxTimestamps || {};
            existingData.minTimestamps = existingData.minTimestamps || {};

            let isUpdated = false;

            for (const [key, value] of Object.entries(filteredValues)) {
                if (value !== undefined && !isNaN(value)) {
                    const numValue = parseFloat(value);

                    if (!existingData.maxValues[key] || numValue > existingData.maxValues[key]) {
                        existingData.maxValues[key] = numValue;
                        if (!existingData.maxTimestamps[key]) existingData.maxTimestamps[key] = [];
                        existingData.maxTimestamps[key].push({ date: formattedDate, time: formattedTime });
                        console.log(`🔺 Updated max for ${key}: ${numValue}`);
                        isUpdated = true;
                    }

                    if (!existingData.minValues[key] || numValue < existingData.minValues[key]) {
                        existingData.minValues[key] = numValue;
                        if (!existingData.minTimestamps[key]) existingData.minTimestamps[key] = [];
                        existingData.minTimestamps[key].push({ date: formattedDate, time: formattedTime });
                        console.log(`🔻 Updated min for ${key}: ${numValue}`);
                        isUpdated = true;
                    }
                }
            }

            // ✅ **Use `findOneAndUpdate()` to ensure MongoDB updates correctly**
            if (isUpdated) {
                await MaxMinData.findOneAndUpdate(
                    { userName: data.userName, stackName, date: formattedDate },
                    {
                        $set: {
                            maxValues: existingData.maxValues,
                            minValues: existingData.minValues,
                            maxTimestamps: existingData.maxTimestamps,
                            minTimestamps: existingData.minTimestamps,
                        }
                    },
                    { new: true, upsert: true }
                );

                console.log(`✅ Min/Max values updated for ${stackName}`);
            } else {
                console.log(`⚠️ No changes required for ${stackName}`);
            }
        }
    } catch (error) {
        console.error('❌ Error updating min/max values:', error);
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
        console.error('❌ Error fetching max/min data by user:', error);
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





/**
 * Function to save or update daily Min/Max values for a given user and stack.
 */
const saveDailyMinMaxValues = async (data) => {
    try {
        if (!Array.isArray(data.stackData)) {
            console.error('❌ stackData is not an array or is undefined:', data.stackData);
            return;
        }

        const formattedDate = moment().tz('Asia/Kolkata').format('DD/MM/YYYY');
        const formattedTime = moment().tz('Asia/Kolkata').format('HH:mm A');

        console.log(`📌 Processing daily min/max for date: ${formattedDate}`);

        for (const stack of data.stackData) {
            const { stackName, stationType, ...values } = stack;

            // ✅ Only process if `stationType` is "effluent"
            if (stationType !== 'effluent') {
                console.log(`⚠️ Skipping stack ${stackName}, stationType is not effluent.`);
                continue;
            }

            // Remove unwanted fields (e.g., Turbidity, pH)
            const filteredValues = Object.fromEntries(
                Object.entries(values).filter(([key]) => key !== 'Turbidity' && key !== 'pH')
            );

            // 🔹 **Find existing record for today**
            let existingData = await MaxMinData.findOne({
                userName: data.userName,
                stackName,
                date: formattedDate,
            });

            if (!existingData) {
                console.log(`📌 No Min/Max data found for ${stackName} on ${formattedDate}. Creating a new entry.`);

                existingData = new MaxMinData({
                    userName: data.userName,
                    stackName,
                    date: formattedDate,
                    maxValues: {},
                    minValues: {},
                    maxTimestamps: {},
                    minTimestamps: {},
                });

                for (const [key, value] of Object.entries(filteredValues)) {
                    if (value !== undefined && !isNaN(value)) {
                        const numValue = parseFloat(value);
                        existingData.maxValues[key] = numValue;
                        existingData.minValues[key] = numValue;
                        existingData.maxTimestamps[key] = [{ date: formattedDate, time: formattedTime }];
                        existingData.minTimestamps[key] = [{ date: formattedDate, time: formattedTime }];
                    }
                }

                await existingData.save();
                console.log(`✅ New document created for ${stackName}`);
                continue;
            }

            // 🔹 **Ensure all fields exist before updating**
            existingData.maxValues = existingData.maxValues || {};
            existingData.minValues = existingData.minValues || {};
            existingData.maxTimestamps = existingData.maxTimestamps || {};
            existingData.minTimestamps = existingData.minTimestamps || {};

            let isUpdated = false;

            for (const [key, value] of Object.entries(filteredValues)) {
                if (value !== undefined && !isNaN(value)) {
                    const numValue = parseFloat(value);

                    console.log(`🔹 Processing ${key}: ${numValue}`);
                    console.log(`🔍 Current Min: ${existingData.minValues[key]}, Max: ${existingData.maxValues[key]}`);

                    if (!existingData.maxValues[key] || numValue > existingData.maxValues[key]) {
                        existingData.maxValues[key] = numValue;
                        existingData.maxTimestamps[key] = existingData.maxTimestamps[key] || [];
                        existingData.maxTimestamps[key].push({ date: formattedDate, time: formattedTime });
                        console.log(`🔺 Updated MAX for ${key}: ${numValue}`);
                        isUpdated = true;
                    }

                    if (!existingData.minValues[key] || numValue < existingData.minValues[key]) {
                        existingData.minValues[key] = numValue;
                        existingData.minTimestamps[key] = existingData.minTimestamps[key] || [];
                        existingData.minTimestamps[key].push({ date: formattedDate, time: formattedTime });
                        console.log(`🔻 Updated MIN for ${key}: ${numValue}`);
                        isUpdated = true;
                    }
                }
            }

            // ✅ **Only update MongoDB if changes were made**
            if (isUpdated) {
                await MaxMinData.findOneAndUpdate(
                    { userName: data.userName, stackName, date: formattedDate },
                    {
                        $set: {
                            maxValues: existingData.maxValues,
                            minValues: existingData.minValues,
                            maxTimestamps: existingData.maxTimestamps,
                            minTimestamps: existingData.minTimestamps,
                        }
                    },
                    { new: true, upsert: true }
                );

                console.log(`✅ Min/Max values updated for ${stackName}`);
            } else {
                console.log(`⚠️ No changes required for ${stackName}`);
            }
        }
    } catch (error) {
        console.error('❌ Error saving daily min/max values:', error);
    }
};



module.exports = { updateMaxMinValues,getMaxMinDataByUserAndStack,getMaxMinDataByUser, getMaxMinDataByDateRange,saveDailyMinMaxValues };