// models/TreatedWaterClarityWeeklyReport.js
const mongoose = require("mongoose");

const treatedWaterEntrySchema = new mongoose.Schema(
  {
    date: { type: Number, required: true }, // 1–31
    photos: [{ type: String }], // S3 URLs
    comment: { type: String, default: "" },
  },
  { _id: false }
);

const treatedWaterClarityWeeklyReportSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userName: { type: String },
    siteName: { type: String },
    year: { type: Number, required: true }, // e.g. 2026
    month: { type: Number, required: true }, // 1–12
    week: { type: Number, required: true }, // 1–4 (1-7, 8-14, 15-21, 22-end)
    entries: [treatedWaterEntrySchema],
  },
  { timestamps: true }
);

// One report per user + month + week
treatedWaterClarityWeeklyReportSchema.index(
  { userId: 1, year: 1, month: 1, week: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "TreatedWaterClarityWeeklyReport",
  treatedWaterClarityWeeklyReportSchema
);
