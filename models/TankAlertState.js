// models/TankAlertState.js
const mongoose = require("mongoose");

const tankAlertStateSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true },
    tankName: { type: String, required: true },
    // normal | low_25 | critical_low | high_85 | critical_high_95
    lastBand: { type: String, default: "normal" },
  },
  { timestamps: true }
);

tankAlertStateSchema.index({ productId: 1, tankName: 1 }, { unique: true });

module.exports = mongoose.model("TankAlertState", tankAlertStateSchema);
