const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const predictionStackSchema = new Schema({
    stackName: { type: String, required: true },
    stationType: { type: String, required: true },
    energyHourlyPrediction: { type: Number, default: 0 },
    flowHourlyPrediction: { type: Number, default: 0 },
    energyDailyPrediction: { type: Number, default: 0 },
    flowDailyPrediction: { type: Number, default: 0 },
    energyMonthlyPrediction: { type: Number, default: 0 },
    flowMonthlyPrediction: { type: Number, default: 0 },
    energyYearlyPrediction: { type: Number, default: 0 },
    flowYearlyPrediction: { type: Number, default: 0 }
});

const predictionDataSchema = new Schema({
    userName: { type: String, required: true },
    product_id: { type: String, required: false },   
    date: { type: String, required: true },
    hour: { type: String, required: true },
    month:{ type:String, required: true},
    stacks: [predictionStackSchema]
}, {
    timestamps: true
});

const Prediction = mongoose.model('Prediction', predictionDataSchema);

module.exports = Prediction;
