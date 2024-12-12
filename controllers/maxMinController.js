const MaxMinData = require('../models/MaxMinData');
const moment = require('moment'); // Import moment.js for date and time formatting

const updateMaxMinValues = async (data) => {
    try {
        const formattedDate = moment().format('DD/MM/YYYY');
        const formattedTime = moment().format('HH:mm');

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
