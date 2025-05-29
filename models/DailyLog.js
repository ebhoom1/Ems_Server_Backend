const mongoose = require('mongoose');
const { Schema } = mongoose;

// ON/OFF status per equipment
const onOffStatusSchema = new Schema({
  equipment: { type: String, required: true },
  status: { type: String, enum: ['on','off'], required: true },
    onTime:  { type: String, default: null },
    offTime: { type: String, default: null }
}, { _id: false });

// A time‐slot entry with all pump statuses
const timeEntrySchema = new Schema({
  time: { type: String, required: true },
  statuses: [ onOffStatusSchema ]
}, { _id: false });

// A simple key/value pair for treated water, chemicals, etc.
const kvEntrySchema = new Schema({
  key: { type: String, required: true },
  value: { type: String }
}, { _id: false });

// Back-wash timing entry
const backwashEntrySchema = new Schema({
  stage: { type: String, required: true },
  time: { type: String }
}, { _id: false });

// Running-hours reading entry
const runningHourEntrySchema = new Schema({
  equipment: { type: String, required: true },
  hours: { type: String }
}, { _id: false });

// Sign-off entry per shift
const signOffEntrySchema = new Schema({
  shift: { type: String, required: true },
  engineerSign: { type: String },
  remarks: { type: String },
  operatorName: { type: String },
  sign: { type: String }
}, { _id: false });

const dailyLogSchema = new Schema({
  date:             { type: Date,   required: true },
  username:         { type: String, required: true },
  companyName:      { type: String, required: true },
   capacity:         { type: String, required: false },
  timeEntries:           [ timeEntrySchema ],      // ON/OFF grid
  treatedWater:          [ kvEntrySchema ],        // Quality, Color…
  remarks:               { type: String },         // Bulk remarks textarea
  chemicalConsumption:   [ kvEntrySchema ],        // NaOCl, NaCl, Lime…
  backwashTimings:       [ backwashEntrySchema ],  // PSF-, ASF-, Softener-
  runningHoursReading:   [ runningHourEntrySchema ], 
  signOff:               [ signOffEntrySchema ]
}, {
  timestamps: true
});

module.exports = mongoose.model('DailyLog', dailyLogSchema);