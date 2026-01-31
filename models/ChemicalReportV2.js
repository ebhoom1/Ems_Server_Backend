const mongoose = require("mongoose");

const RowSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    received: { type: String, default: "" },
    opening: { type: String, default: "" },
    consumption: { type: String, default: "" },
    closing: { type: String, default: "0.00" },
  },
  { _id: false }
);

const ChemicalSchema = new mongoose.Schema(
  {
    chemicalName: { type: String, required: true },   // ✅ IMPORTANT
    rows: { type: [RowSchema], default: [] },
  },
  { _id: false }
);

const ChemicalReportV2Schema = new mongoose.Schema(
  {
    userName: { type: String, required: true },
    siteName: { type: String, default: "" },
    year: { type: Number, required: true },
    month: { type: Number, required: true },
    chemicals: { type: [ChemicalSchema], default: [] },
  },
  { timestamps: true }
);

ChemicalReportV2Schema.index({ userName: 1, year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model("ChemicalReportV2", ChemicalReportV2Schema);
