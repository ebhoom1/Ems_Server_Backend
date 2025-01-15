const mongoose = require('mongoose');
const moment = require('moment');

const stationSchema = new mongoose.Schema({
    stationName: {
        type: String,
        required: true
    },
    stationType: {
        type: String,
        required: true
    },
    kg: {
        type: Number,
        required: true
    },
    date: {
        type: String,
        required: true
    },
    time: {
        type: String,
        required: true
    }
});

const wasteSchema = new mongoose.Schema({
    userName: {
        type: String,
        required: true
    },
    userType: {
        type: String,
        required: true,
        enum: ['user', 'admin']
    },
    stations: [stationSchema],
    createdAt: {
        type: Date,
        default: () => moment().toDate()
    },
    updatedAt: {
        type: Date,
        default: () => moment().toDate()
    }
});

const Waste = mongoose.model('Waste', wasteSchema);

module.exports = Waste;
