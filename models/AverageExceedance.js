const mongoose = require('mongoose');

const AverageExceedanceSchema = new mongoose.Schema({
    userName: { type: String, required: true },
    interval: { type: String, required: true },
    intervalType: { type: String, required: true },
    dateAndTime: { type: String },
    timestamp: { type: Date, default: Date.now },
    stackData: [
        {
            stackName: { type: String, required: true },
            parameters: {
                type: Map,
                of: Number,  // Stores parameter names and their average values
            },
        },
    ],
});

const AverageExceedance = mongoose.model('AverageExceedance', AverageExceedanceSchema);
module.exports = AverageExceedance;
