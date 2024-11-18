const mongoose = require('mongoose');

const ExceedanceStatsSchema = new mongoose.Schema({
    date: { type: String, required: true }, // format 'DD/MM/YYYY'
    hour: { type: Number }, // hour of the day (0-23)
    exceedanceCount: { type: Number, default: 0 }, // Total count of ExceedanceColor 'red'
    intervalExceedanceCount: { type: Number, default: 0 }, // Total count of timeIntervalColor 'purple'
    period: { type: String, enum: ['hourly', 'daily', 'monthly'], required: true }
});

const ExceedanceStats = mongoose.model('ExceedanceStats', ExceedanceStatsSchema);
module.exports = ExceedanceStats;
