// FILE: models/CriticalSpareWeeklyReport.js
const mongoose = require("mongoose");

const SpareItemSchema = new mongoose.Schema(
  {
    equipment: { type: String, required: true },
    item: { type: String, required: true },
    quantity: { type: String, default: "" },
  },
  { _id: false }
);

const CriticalSpareWeeklyReportSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    userName: { type: String, required: true },
    siteName: { type: String },

    year: { type: Number, required: true },
    month: { type: Number, required: true }, // 1–12
    week: { type: Number, required: true },  // 1–4

    spares: [SpareItemSchema],
  },
  { timestamps: true }
);

// one report per site per month per week
CriticalSpareWeeklyReportSchema.index(
  { userName: 1, year: 1, month: 1, week: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "CriticalSpareWeeklyReport",
  CriticalSpareWeeklyReportSchema
);
