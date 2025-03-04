// models/dailyConsumptionModel.js
const mongoose = require('mongoose');

const dailyConsumptionSchema = new mongoose.Schema(
  {
    userName: { type: String, required: true },
    stackName: { type: String, required: true },
    // You can store date as a string (e.g., "DD/MM/YYYY") or as a Date object
    date: { type: String, required: true },
    consumption: { type: Number, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DailyConsumption', dailyConsumptionSchema);
