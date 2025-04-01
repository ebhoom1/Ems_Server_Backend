// models/InventoryItem.js
const mongoose = require("mongoose");

const inventoryItemSchema = new mongoose.Schema({
  userName: { type: String, required: true },
  skuName: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0 },
  date: { type: Date, required: true },
  // Optional logs for usage and requests
  usageLog: [{ date: Date, quantityUsed: Number, notes: String }],
 
});

module.exports = mongoose.model("InventoryItem", inventoryItemSchema);
