// FILE: models/EquipmentStatusReport.js
const mongoose = require("mongoose");

const equipmentEntrySchema = new mongoose.Schema(
  {
    slNo: { type: Number, required: true },
    equipmentName: { type: String, required: true }, // STP Equipment
    capacity: { type: String, default: "" },
    make: { type: String, default: "" },
    status: { type: String, default: "" },
    comment: { type: String, default: "" },
  
notes: { type: String, default: "" },

  },
  { _id: false }
);

const equipmentStatusReportSchema = new mongoose.Schema(
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
    entries: [equipmentEntrySchema],
  },
  { timestamps: true }
);

equipmentStatusReportSchema.index(
  { userId: 1, year: 1, month: 1 },
  { unique: true }
);

const EquipmentStatusReport = mongoose.model(
  "EquipmentStatusReport",
  equipmentStatusReportSchema
);

module.exports = EquipmentStatusReport;
