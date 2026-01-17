const mongoose = require("mongoose");

const ChemicalReadingSchema = new mongoose.Schema(
  {
    date: { type: String, required: true }, // DD/MM/YYYY
    initialQty: { type: Number, default: 0 },
    receivedQty: { type: Number, default: 0 },
    usedQty: { type: Number, default: 0 },
    finalQty: { type: Number, default: 0 },
  },
  { _id: false }
);

const ChemicalItemSchema = new mongoose.Schema(
  {
    chemicalName: { type: String, required: true },
    readings: { type: [ChemicalReadingSchema], default: [] },
  },
  { _id: false }
);

const ChemicalMonthlyReportSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    userName: { type: String, required: true },
    siteName: { type: String },

    year: { type: Number, required: true },
    month: { type: Number, required: true }, // 1-12

    chemicals: { type: [ChemicalItemSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ChemicalMonthlyReport", ChemicalMonthlyReportSchema);
