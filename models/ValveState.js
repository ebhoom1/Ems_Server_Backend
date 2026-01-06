const mongoose = require("mongoose");

const ValveStateSchema = new mongoose.Schema({
  productId: String,
  valveId: String,
  status: Boolean,
  pending: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model("ValveState", ValveStateSchema);
