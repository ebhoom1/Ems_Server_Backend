const mongoose = require('mongoose');

const hourlyDataSchema = new mongoose.Schema({
    userName: String,
    product_id: String,
    hour: String,
    date: String,
    month: String,  // Added to store the month
    year: String,   // Added to store the year
    stacks: [{
        stackName: String,
        stationType: String,
        energy: Number,
        cumulatingFlow: Number
    }]
});

const HourlyData = mongoose.model('HourlyData', hourlyDataSchema);

module.exports = HourlyData;
