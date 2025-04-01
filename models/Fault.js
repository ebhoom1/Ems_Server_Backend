// models/Fault.js
const mongoose = require('mongoose');

const faultSchema = new mongoose.Schema({
  equipmentName: { type: String, required: true },
  faultDescription: { type: String, required: true },
  reportedDate: { type: String, required: true },
  userName: { type: String, required: true },
  status: { type: String, enum: ['Pending', 'Serviced'], default: 'Pending' },
  serviceDate: { type: String },
  technicianName: { type: String },
  nextServiceDue: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Fault', faultSchema);