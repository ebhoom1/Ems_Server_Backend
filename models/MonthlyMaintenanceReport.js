// models/MonthlyReport.js
const mongoose = require('mongoose');

const entrySchema = new mongoose.Schema(
  {
    // Day-of-month: 1–31
    date: { type: Number, required: true },
    photos: [
      {
        url: { type: String, required: true }, // S3 URL
        type: {
          type: String,
          enum: ['MPM', 'EPM','GENERAL'],
          default: 'MPM',
        },
      },
    ],
    comment: { type: String, default: '' },
  },
  { _id: false }
);


const monthlyMaintenanceReportSchema = new mongoose.Schema(
  {
    // Change to String if you use userName instead of ObjectId
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    year: { type: Number, required: true }, // e.g. 2025
    month: { type: Number, required: true }, // 1–12
    entries: [entrySchema],
  },
  { timestamps: true }
);

monthlyMaintenanceReportSchema.index({ userId: 1, year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('MonthlyMaintenanceReport', monthlyMaintenanceReportSchema);
