const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const consumptionStackSchema = new Schema({
    stackName: { type: String, required: true },
    stationType: { type: String, required: true },
    energyHourlyConsumption: { type: Number, default: 0 },
    flowHourlyConsumption: { type: Number, default: 0 },
    energyDailyConsumption: { type: Number, default: 0 },
    flowDailyConsumption: { type: Number, default: 0 },
    energyMonthlyConsumption: { type: Number, default: 0 },
    flowMonthlyConsumption: { type: Number, default: 0 },
    energyYearlyConsumption: { type: Number, default: 0 },
    flowYearlyConsumption: { type: Number, default: 0 }
});

const consumptionDataSchema = new Schema({
    userName: { type: String, required: true },
    product_id: { type: String, required: true },
    date: { type: String, required: true },
    hour:{type: String, required:true},
    month:{type:String, required:true},
    stacks: [consumptionStackSchema]
}, {
    timestamps: true
});

const Consumption = mongoose.model('Consumption', consumptionDataSchema);

module.exports = Consumption;
