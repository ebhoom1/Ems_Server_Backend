const mongoose = require("mongoose");

/* -------- Single Day Reading -------- */
const dailyReadingSchema = new mongoose.Schema(
  {
    date: { type: String, required: true }, // "01", "02", etc

    // Dynamic parameters (MLSS, PH, COD, TSS, etc)
    values: {
      type: Map,
      of: Number,        // all values are numbers or null
      default: {}
    },

    comment: { type: String, default: "" }
  },
  { _id: false }
);

/* -------- Monthly Report -------- */
const MlssPhReportSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    userName: { type: String, required: true },
    siteName: { type: String },

    year: { type: Number, required: true },
    month: { type: Number, required: true }, // 0–11

    readings: [dailyReadingSchema]
  },
  { timestamps: true }
);

/* Prevent duplicate month entries */
MlssPhReportSchema.index(
  { userId: 1, year: 1, month: 1 },
  { unique: true }
);

module.exports = mongoose.model("MlssPhReport", MlssPhReportSchema);
