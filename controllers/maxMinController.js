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
            const existingData = await MaxMinData.findOne({
                userName: data.userName,
                stackName,
            });

            const newMaxValues = { ...existingData?.maxValues };
            const newMinValues = { ...existingData?.minValues };

            for (const [key, value] of Object.entries(values)) {
                if (value !== undefined && !isNaN(value)) {
                    const numValue = parseFloat(value);
                    if (!newMaxValues[key] || numValue > newMaxValues[key]) {
                        newMaxValues[key] = numValue;
                    }
                    if (!newMinValues[key] || numValue < newMinValues[key]) {
                        newMinValues[key] = numValue;
                    }
                }
            }

            if (existingData) {
                await MaxMinData.updateOne(
                    { userName: data.userName, stackName },
                    { 
                        maxValues: newMaxValues,
                        minValues: newMinValues,
                        date: formattedDate,
                        time: formattedTime
                    }
                );
            } else {
                await MaxMinData.create({
                    userName: data.userName,
                    stackName,
                    maxValues: newMaxValues,
                    minValues: newMinValues,
                    date: formattedDate,
                    time: formattedTime
                });
            }
        }
    } catch (error) {
        console.error('Error updating max/min values:', error);
    }
};


module.exports = { updateMaxMinValues };
