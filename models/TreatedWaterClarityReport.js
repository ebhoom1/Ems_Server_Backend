// models/TreatedWaterClarityReport.js
const mongoose = require("mongoose");

const treatedWaterEntrySchema = new mongoose.Schema(
  {
    date: { type: Number, required: true }, // 1–31
    photos: [{ type: String }], // S3 URLs
  },
  { _id: false }
);

const treatedWaterClarityReportSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userName: { type: String },
    siteName: { type: String },
    year: { type: Number, required: true }, // e.g. 2025
    month: { type: Number, required: true }, // 1–12
    entries: [treatedWaterEntrySchema],
  },
  { timestamps: true }
);

// One report per user + month
treatedWaterClarityReportSchema.index(
  { userId: 1, year: 1, month: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "TreatedWaterClarityReport",
  treatedWaterClarityReportSchema
);
