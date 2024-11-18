const mongoose = require('mongoose');

// Define schema for storing average data in the required format
const IotDataAverageSchema = new mongoose.Schema({
    userName: { type: String, required: true },
    product_id: { type: String, required: true },
    interval: { type: String, required: true },
    intervalType: { type: String, required: true }, 
    dateAndTime: { type: String },
    timestamp: { type: Date, default: Date.now },
    stackData: [
        {
            stackName: { type: String, required: true },
            stationType: { type: String },  // Optional field if applicable
            parameters: { 
                type: Map,  // Stores key-value pairs (parameter name and its average)
                of: Number, 
            },
        },
    ],
});

const IotDataAverage = mongoose.model('IotDataAverage', IotDataAverageSchema);

module.exports = IotDataAverage;
