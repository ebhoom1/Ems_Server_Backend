// models/LastIotData.js

const mongoose = require('mongoose');

const lastIotDataSchema = new mongoose.Schema({
    userName: { type: String, required: true, unique: true },
    product_id: String,
    stackData: Array,
    date: String,
    time: String,
    companyName: String,
    industryType: String,
    mobileNumber: String,
    email: String,
    timestamp: Date,
    validationMessage: String,
    validationStatus: String,
});

module.exports = mongoose.model('LastIotData', lastIotDataSchema);
