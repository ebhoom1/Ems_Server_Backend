const mongoose = require("mongoose");

const SpareItemSchema = new mongoose.Schema(
  {
    equipment: { type: String, required: true },
    item: { type: String, required: true },
    quantity: { type: String, default: "" }, // user editable
  },
  { _id: false }
);

const CriticalSpareReportSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    userName: { type: String, required: true },
    siteName: { type: String },

    year: { type: Number, required: true },
    month: { type: Number, required: true }, // 1–12

    spares: [SpareItemSchema],
  },
  { timestamps: true }
);

/* one report per site per month */
CriticalSpareReportSchema.index(
  { userName: 1, year: 1, month: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "CriticalSpareReport",
  CriticalSpareReportSchema
);
