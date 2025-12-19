const mongoose = require("mongoose");

const DailyConsumptionSchema = new mongoose.Schema(
  {
    date: { type: String, required: true }, // DD/MM/YYYY
    NaOCl: { type: Number, default: 0 },
    PE: { type: Number, default: 0 },
    PAC: { type: Number, default: 0 },
    NaOH: { type: Number, default: 0 },
    NaCl: { type: Number, default: 0 },
    Biosol: { type: Number, default: 0 },
    HCL_CITRIC: { type: Number, default: 0 },
  },
  { _id: false }
);

const ChemicalConsumptionReportSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    userName: { type: String, required: true },
    siteName: { type: String },

    year: { type: Number, required: true },
    month: { type: Number, required: true }, // 1–12

    readings: [DailyConsumptionSchema],
  },
  { timestamps: true }
);

ChemicalConsumptionReportSchema.index(
  { userName: 1, year: 1, month: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "ChemicalConsumptionReport",
  ChemicalConsumptionReportSchema
);
