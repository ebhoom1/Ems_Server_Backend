// models/RequestInventory.js
const mongoose = require("mongoose");

const requestInventorySchema = new mongoose.Schema({
  userName: { type: String, required: true },
  skuName: { type: String, required: true },
  quantityRequested: { type: Number, required: true },
  reason: { type: String },
  requestDate: { type: Date, default: Date.now },
  status: { type: String, enum: ["Pending", "Approved", "Denied"], default: "Pending" },
});

module.exports = mongoose.model("RequestInventory", requestInventorySchema);
