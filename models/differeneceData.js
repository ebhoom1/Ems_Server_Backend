const mongoose = require('mongoose');

const DifferenceDataSchema = new mongoose.Schema({
    userName: { type: String, required: true },
    stackName: { type: String, required: true },
    stationType: { type: String },
    interval: { type: String, required: true }, // 'hourly', 'daily', etc.
    intervalType: { type: String, required: true }, // e.g., 'hour', 'day'
    date: { type: String, required: true }, // 'DD/MM/YYYY' for daily interval
    time: { type: String }, // 'HH:mm' for hourly interval
    initialEnergy: { type: Number },
    lastEnergy: { type: Number },
    energyDifference: { type: Number },
    initialInflow: { type: Number },
    lastInflow: { type: Number },
    inflowDifference: { type: Number },
    initialFinalFlow: { type: Number },
    lastFinalFlow: { type: Number },
    finalFlowDifference: { type: Number },
    timestamp: { type: Date, default: Date.now },
});

const DifferenceData = mongoose.model('DifferenceData', DifferenceDataSchema);
module.exports = DifferenceData;
