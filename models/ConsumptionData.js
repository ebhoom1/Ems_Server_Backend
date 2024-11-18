const mongoose = require('mongoose');

// Define the schema for individual stack consumption data
const StackConsumptionSchema = new mongoose.Schema({
    stackName: { type: String, required: true },
    stationType: { type: String, default: 'NIL' },
    inflow: { type: Number, default: 0 },
    finalflow: { type: Number, default: 0 },
    energy: { type: Number, default: 0 }
});

// Define the schema for total consumption data
const ConsumptionDataSchema = new mongoose.Schema({
    userName: { type: String, required: true },
    product_id: { type: String, required: true },
    companyName: { type: String, required: true },
    email: { type: String, required: true },
    mobileNumber: { type: String, required: true },
    interval: { type: String, required: true },
    intervalType: { type: String, required: true },
    totalConsumptionData: [StackConsumptionSchema], // Array for multiple stack entries
    timestamp: { type: Date, default: Date.now }
});

const ConsumptionData = mongoose.model('ConsumptionData', ConsumptionDataSchema);

module.exports = ConsumptionData;
