// FILE: models/EquipmentStatusWeeklyReport.js
const mongoose = require("mongoose");

const equipmentEntrySchema = new mongoose.Schema(
  {
    slNo: { type: Number, required: true },
    equipmentName: { type: String, required: true },
    capacity: { type: String, default: "" },
    make: { type: String, default: "" },
    status: { type: String, default: "" },
    comment: { type: String, default: "" },
  },
  { _id: false }
);

const equipmentStatusWeeklyReportSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userName: { type: String },
    siteName: { type: String },
    year: { type: Number, required: true },
    month: { type: Number, required: true }, // 1–12
    week: { type: Number, required: true },  // 1–4
    note: { type: String, default: "" },
    entries: [equipmentEntrySchema],
  },
  { timestamps: true }
);

equipmentStatusWeeklyReportSchema.index(
  { userId: 1, year: 1, month: 1, week: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "EquipmentStatusWeeklyReport",
  equipmentStatusWeeklyReportSchema
);
