const mongoose = require("mongoose");

const parameterSchema = new mongoose.Schema(
  {
    parameter: { type: String, required: true },
    unit: { type: String, default: "" },
    rawResult: { type: String, default: "" },
    kspcbStandard: { type: String, default: "" },
    treatedResult: { type: String, default: "" },
  },
  { _id: false }
);

const plantOperatingReportSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userName: { type: String, required: true },
    siteName: { type: String, required: true },

    clientName: { type: String, default: "" },
    utility: { type: String, default: "STP" },
    capacity: { type: String, default: "" },

    // e.g. "November 2025"
    month: { type: String, required: true },

    parameters: [parameterSchema],
  },
  { timestamps: true }
);

// one report per site per month
plantOperatingReportSchema.index(
  { userName: 1, month: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "PlantOperatingReport",
  plantOperatingReportSchema
);
