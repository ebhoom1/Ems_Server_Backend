const MaxMinData = require('../models/MaxMinData');
const moment = require('moment-timezone'); // Import moment-timezone for timezone handling


const updateMaxMinValues = async (data) => {
    try {
        if (!Array.isArray(data.stackData)) {
            console.error('stackData is not an array or is undefined:', data.stackData);
            return;
        }

        const formattedDate = moment().tz('Asia/Kolkata').format('DD/MM/YYYY');
        const formattedTime = moment().tz('Asia/Kolkata').format('hh:mm A'); // 12-hour format with AM/PM

        for (const stack of data.stackData) {
            const { stackName, ...values } = stack;

            // Filter out 'Turbidity' and 'pH'
            const filteredValues = Object.fromEntries(
                Object.entries(values).filter(
                    ([key]) => key !== 'Turbidity' && key !== 'pH'
                )
            );

            const existingData = await MaxMinData.findOne({
                userName: data.userName,
                stackName,
            });

            let newMaxValues = existingData?.maxValues || {};
            let newMinValues = existingData?.minValues || {};
            let maxTimestamps = existingData?.maxTimestamps || {};
            let minTimestamps = existingData?.minTimestamps || {};

            let maxChanged = false;
            let minChanged = false;

            for (const [key, value] of Object.entries(filteredValues)) {
                if (value !== undefined && !isNaN(value)) {
                    const numValue = parseFloat(value);

                    // Check and update max values and timestamps
                    if (!newMaxValues[key] || numValue > newMaxValues[key]) {
                        newMaxValues[key] = numValue;
                        maxTimestamps[key] = { date: formattedDate, time: formattedTime };
                        maxChanged = true;
                    }

                    // Check and update min values and timestamps
                    if (!newMinValues[key] || numValue < newMinValues[key]) {
                        newMinValues[key] = numValue;
                        minTimestamps[key] = { date: formattedDate, time: formattedTime };
                        minChanged = true;
                    }
                }
            }

            const updateData = {
                maxValues: newMaxValues,
                minValues: newMinValues,
                maxTimestamps,
                minTimestamps,
            };

            if (existingData) {
                await MaxMinData.updateOne(
                    { userName: data.userName, stackName },
                    updateData
                );
            } else {
                await MaxMinData.create({
                    userName: data.userName,
                    stackName,
                    ...updateData,
                });
            }
        }
    } catch (error) {
        console.error('Error updating max/min values:', error);
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

module.exports = { updateMaxMinValues,getMaxMinDataByUserAndStack,getMaxMinDataByUser };
