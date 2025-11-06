const mongoose = require('mongoose');

// Schema for an individual day's reading
const readingSchema = new mongoose.Schema({
  date: { 
    type: String, 
    required: true 
  }, // e.g., "01", "02", ... "31"
  mlss: { 
    type: Number, 
    default: null 
  },
  ph: { 
    type: Number, 
    default: null 
  },
  comment: { 
    type: String, 
    default: null 
  }
}, { _id: false }); // Don't create separate _id for each reading

// Main schema for the monthly report
const monthlyReportSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', // Reference to your User model
    required: true 
  },
  userName: { 
    type: String, 
    required: true, 
    index: true // Index for fast lookups by userName
  },
  siteName: { 
    type: String 
  },
  year: { 
    type: Number, 
    required: true 
  },
  month: { 
    type: Number, // 0-11 (Jan-Dec)
    required: true 
  },
  readings: [readingSchema] // Array of daily readings
}, { timestamps: true });

// Create a unique compound index
monthlyReportSchema.index({ userId: 1, year: 1, month: 1 }, { unique: true });

const MonthlyReport = mongoose.model('MonthlyReport', monthlyReportSchema);

module.exports = MonthlyReport;