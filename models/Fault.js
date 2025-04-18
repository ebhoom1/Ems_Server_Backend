// models/Fault.js
const mongoose = require('mongoose');

const faultSchema = new mongoose.Schema({
  equipmentId: { type: String, required: true },         // added for QR scanning
  equipmentName: { type: String, required: true },
  faultDescription: { type: String, required: true },
  photos: { type: [String], default: [] },                // array of base64-encoded images
  reportedDate: { type: String, required: true },
  userName: { type: String, required: true },
  status: { type: String, enum: ['Pending', 'Serviced'], default: 'Pending' },
  serviceDate: { type: String },
  technicianName: { type: String },
  partsUsed: { type: String },                            // added for service details
  serviceDetails: { type: String },                       // added for service details
  nextServiceDue: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Fault', faultSchema);
