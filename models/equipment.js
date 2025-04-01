const mongoose = require('mongoose');

const equipmentSchema = new mongoose.Schema({
  equipmentName: { type: String, required: true },
  modelSerial: { type: String, required: true },
  installationDate: { type: Date, required: true },
  location: { type: String, required: true },
  notes: { type: String },
  userName: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Equipment', equipmentSchema);
