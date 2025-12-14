const mongoose = require("mongoose");

const ChemicalReadingSchema = new mongoose.Schema(
  {
    date: { type: String, required: true }, // DD/MM/YYYY
    received: { type: Number, default: 0 },
    openingStock: { type: Number, default: 0 },
    consumption: { type: Number, default: 0 },
    closedStock: { type: Number, default: 0 },
  },
  { _id: false }
);

const ChemicalReportSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    userName: { type: String, required: true },
    siteName: { type: String },

    chemicalName: { type: String, required: true },

    year: { type: Number, required: true },
    month: { type: Number, required: true },

    readings: [ChemicalReadingSchema],

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ChemicalReport", ChemicalReportSchema);
