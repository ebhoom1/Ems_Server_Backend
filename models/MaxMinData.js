const mongoose = require('mongoose');

const MaxMinDataSchema = new mongoose.Schema({
    userName: { type: String, required: true },
    stackName: { type: String, required: true },
    maxValues: { type: Object, default: {} },
    minValues: { type: Object, default: {} },
    date: { type: String, required: true }, // Format: dd/mm/yyyy
    time: { type: String, required: true }, // Format: HH:mm
    timestamp: { type: Date, default: Date.now },
});

const MaxMinData = mongoose.model('MaxMinData', MaxMinDataSchema);
module.exports = MaxMinData;
