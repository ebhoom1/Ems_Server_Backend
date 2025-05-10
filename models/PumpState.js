// models/PumpState.js
const mongoose = require('mongoose');

const PumpStateSchema = new mongoose.Schema({
    productId: {
      type: String,
      required: true,
      index: true
    },
    pumpId: {
      type: String,
      required: true,
      index: true
    },
    status: {
      type: Boolean,
      default: false
    },
    pending: {
      type: Boolean,
      default: false
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  }, {
    timestamps: true
  });
// Compound index for faster queries
PumpStateSchema.index({ productId: 1, pumpId: 1 }, { unique: true });

module.exports = mongoose.model('PumpState', PumpStateSchema);