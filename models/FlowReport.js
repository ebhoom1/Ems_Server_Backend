const mongoose = require('mongoose');

// Schema for an individual day's reading
const flowReadingSchema = new mongoose.Schema({
  date: { 
    type: String, 
    required: true 
  },
  inletInitial: {
    type: Number,
    default: null
  },
  inletFinal: { 
    type: Number, 
    default: null 
  },
  inletComment: { 
    type: String, 
    default: null 
  },
  outletInitial: {
    type: Number,
    default: null
  },
  outletFinal: { 
    type: Number, 
    default: null 
  },
  outletComment: { 
    type: String, 
    default: null 
  }
}, { _id: false }); 

// Main schema for the monthly flow report
const flowReportSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  userName: { 
    type: String, 
    required: true, 
    index: true 
  },
  siteName: { 
    type: String 
  },
  year: { 
    type: Number, 
    required: true 
  },
  month: { 
    type: Number, 
    required: true 
  },
  readings: [flowReadingSchema] 
}, { timestamps: true });

// Create a unique compound index
flowReportSchema.index({ userId: 1, year: 1, month: 1 }, { unique: true });

const FlowReport = mongoose.model('FlowReport', flowReportSchema);

module.exports = FlowReport;