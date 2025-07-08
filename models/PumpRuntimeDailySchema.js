const mongoose = require('mongoose');

const PumpRuntimeDailySchema = new mongoose.Schema({
  userName: { type: String, required: true },
  product_id: { type: String, required: true },
  pumpId: { type: String, required: true },
  pumpName: { type: String, required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  totalRuntimeMs: { type: Number, default: 0 }, // total ON duration in milliseconds
  lastOnTime: { type: Date, default: null }
}, { timestamps: true });

PumpRuntimeDailySchema.index({ userName: 1, product_id: 1, pumpId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('PumpRuntimeDaily', PumpRuntimeDailySchema);