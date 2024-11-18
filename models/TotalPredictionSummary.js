
const mongoose = require('mongoose');

const TotalPredictionSummarySchema = new mongoose.Schema({
    userName: { type: String, required: true },
    product_id: { type: String, required: false },
    date:{ type: String, required:true},
    companyName:{type:String, required:true},
    mobileNumber:{type:String, required:true},
    email:{type:String, required:true},
    interval: { type: String, required: true },
    intervalType: { type: String, required: true },
    totalEnergyPrediction: { type: Number, default: 0 },
    totalFlowPrediction: { type: Number, default: 0 },
});

module.exports = mongoose.model('TotalPredictionSummary', TotalPredictionSummarySchema);
