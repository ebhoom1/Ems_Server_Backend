const mongoose = require("mongoose");

const readingSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },

    greyWaterInitial: String,
    greyWaterFinal: String,
    greyWaterTotal: String,
    soilLine: String,
    equalization: String,
    totalGreySoil: String,

    inletInitial: String,
    inletFinal: String,
    inletTotal: String,

    permeateInitial: String,
    permeateFinal: String,
    permeateTotal: String,

    finalTankLevel: String,

    cBlockInitial: String,
    cBlockFinal: String,
    cBlockTotal: String,

    mBlockInitial: String,
    mBlockFinal: String,
    mBlockTotal: String,

    gBlockInitial: String,
    gBlockFinal: String,
    gBlockTotal: String,

    gardenInitial: String,
    gardenFinal: String,
    gardenTotal: String,

    treatedViaG: String,
  },
  { _id: false }
);

const WaterBalanceReportSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    userName: String,
    siteName: String,
    year: Number,
    month: Number,
    readings: [readingSchema],
  },
  { timestamps: true }
);

WaterBalanceReportSchema.index(
  { userName: 1, year: 1, month: 1 },
  { unique: true }
);

module.exports = mongoose.model("WaterBalanceReport", WaterBalanceReportSchema);
