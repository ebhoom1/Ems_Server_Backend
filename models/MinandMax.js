const mongoose = require('mongoose');

const MaxandMinDataSchema = new mongoose.Schema({
    userName: { type: String, required: true },
    stackName: { type: String, required: true },
    date: { type: String, required: true }, // Save the date in dd/mm/yyyy format
    maxValues: { type: Object, default: {} },
    minValues: { type: Object, default: {} },
    maxTimestamps: { type: Map, of: Array, default: {} }, // Array of records for each parameter
    minTimestamps: { type: Map, of: Array, default: {} }, // Array of records for each parameter
    timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('MaxandMinData', MaxandMinDataSchema);
