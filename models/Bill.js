const mongoose = require('mongoose');

const billSchema = new mongoose.Schema({
    userName: { type: String, required: true },
    month: { type: String, required: true },
    monthlyEnergyConsumption: { type: Number, required: true },
    fixedCost: { type: Number, required: true },
    totalBill: { type: Number, required: true },
    calculatedAt: { type: Date, default: Date.now }
});

const Bill = mongoose.model('Bill', billSchema);

module.exports = Bill;