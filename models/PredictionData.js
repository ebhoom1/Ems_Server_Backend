const mongoose = require('mongoose');

// Define the schema for storing prediction data
const PredictionDataSchema = new mongoose.Schema({
    userName: { type: String, required: true },
    product_id: { type: String, required: true },
    predictionType: { type: String, required: true }, // hour, day, month
    timestamp: { type: Date, default: Date.now },
    predictionData: [
        {
            stackName: { type: String, required: true },
            stationType: { type: String, default: 'NIL' },
            predictedInflow: { type: Number, default: 0 },
            predictedFinalflow: { type: Number, default: 0 },
            predictedEnergy: { type: Number, default: 0 },
        },
    ],
});

const PredictionData = mongoose.model('PredictionData', PredictionDataSchema);


