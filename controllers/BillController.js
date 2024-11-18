// controllers/BillController.js

const TotalConsumptionSummary = require('../models/TotalConsumptionSummary');
const Bill = require('../models/Bill');
const moment = require('moment');

exports.calculateElectricityBill = async (req, res) => {
    try {
        const { userName, fixedCost } = req.body;
        const currentMonth = moment().format('MM/YYYY'); // Formats the current month and year in MM/YYYY

        // Find total energy consumption for the current month by aggregating hourly data
        const consumption = await TotalConsumptionSummary.aggregate([
            { 
                $match: { 
                    userName: userName,
                    date: { $regex: `${currentMonth}` } // Regex to match the month and year in the date string
                }
            },
            { 
                $group: {
                    _id: null,
                    totalEnergy: { $sum: "$totalEnergy" }
                }
            }
        ]);

        if (consumption.length === 0) {
            return res.status(404).json({ message: "No consumption data found for this month." });
        }

        const monthlyConsumption = consumption[0].totalEnergy;
        const totalBill = (monthlyConsumption * 10) + fixedCost;

        const newBill = new Bill({
            userName,
            month: currentMonth,
            monthlyEnergyConsumption: monthlyConsumption,
            fixedCost,
            totalBill,
            calculatedAt: new Date() // Timestamp when the bill is calculated
        });

        await newBill.save();

        res.json({
            message: "Electricity bill calculated successfully.",
            data: newBill
        });
    } catch (error) {
        console.error('Failed to calculate electricity bill:', error);
        res.status(500).json({ message: 'Error calculating electricity bill', error });
    }
};
