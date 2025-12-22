const mongoose = require("mongoose");

const readingSchema = new mongoose.Schema(
  {
    date: String,                 // 01-Sep-25
    initialReading: Number,
    finalReading: Number,
    consumption: Number,          // final - initial
    unit: Number,                 // same as consumption (kW)
  },
  { _id: false }
);

const powerConsumptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    userName: { type: String, required: true },
    siteName: String,
    year: Number,
    month: Number, // 1–12
    readings: [readingSchema],
  },
  { timestamps: true }
);

powerConsumptionSchema.index(
  { userName: 1, year: 1, month: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "PowerConsumptionReport",
  powerConsumptionSchema
);
