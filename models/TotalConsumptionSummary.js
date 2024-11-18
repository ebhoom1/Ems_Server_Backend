// models/TotalConsumptionSummary.js

const mongoose = require('mongoose');

const TotalConsumptionSummarySchema = new mongoose.Schema({
    userName: { type: String, required: true },
    product_id: { type: String, required: true },
    companyName: { type: String, required: true },
    email: { type: String, required: true },
    mobileNumber: { type: String, required: true },
    interval: { type: String, required: true },
    intervalType: { type: String, required: true },
    totalEnergy: { type: Number, default: 0 },
    totalCumulatingFlow: { type: Number, default: 0 },
    date:{type:String,required:true},
    
});

module.exports = mongoose.model('TotalConsumptionSummary', TotalConsumptionSummarySchema);
