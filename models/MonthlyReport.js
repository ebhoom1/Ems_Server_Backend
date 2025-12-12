const mongoose = require("mongoose");

// Single flowmeter reading for a specific day
const flowMeterReadingSchema = new mongoose.Schema({
  initial: { type: Number, default: null },
  final: { type: Number, default: null },
  comment: { type: String, default: "" }
}, { _id: false });

// Single day's entry
const dailyReadingSchema = new mongoose.Schema({
  date: { type: String, required: true },
  flowMeters: [flowMeterReadingSchema] // array based on flowMeterNames
}, { _id: false });

// Main Schema
const monthlyReportSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  userName: { type: String, required: true },
  siteName: { type: String },

  year: { type: Number, required: true },
  month: { type: Number, required: true },

  flowMeterNames: { type: [String], default: ["Inlet", "Outlet"] },

  readings: [dailyReadingSchema],

}, { timestamps: true });

monthlyReportSchema.index({ userId: 1, year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model("MonthlyReport", monthlyReportSchema);
