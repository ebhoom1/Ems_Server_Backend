const mongoose = require('mongoose');

const MaxMinDataSchema = new mongoose.Schema({
    userName: { type: String, required: true },
    stackName: { type: String, required: true },
    maxValues: { type: Object, default: {} },
    minValues: { type: Object, default: {} },
    maxTimestamps: { type: Object, default: {} }, // Store timestamps for max values
    minTimestamps: { type: Object, default: {} }, // Store timestamps for min values
    timestamp: { type: Date, default: Date.now },
});

const MaxMinData = mongoose.model('MaxMinData', MaxMinDataSchema);
module.exports = MaxMinData;
