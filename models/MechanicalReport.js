// models/MechanicalReport.js
const mongoose = require('mongoose');

const TechnicianSchema = new mongoose.Schema({
  name: String,
  designation: String,
  email: String
});

// store both name and value
const CheckSchema = new mongoose.Schema({
  column: { type: String, required: true },
  value:  { type: String, default: '' }
});

const EntrySchema = new mongoose.Schema({
  id:          { type: Number, required: true },
  category:    { type: String, required: true },
  description: { type: String },
  checks:      [CheckSchema],    // ← changed
  remarks:     { type: String, default: '' }
});

const MechanicalReportSchema = new mongoose.Schema({
  equipmentId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Equipment', required: true },
  equipmentName: { type: String, required: true },
  userName:      { type: String, required: true },       // ✅ New field
  capacity:      { type: String },         // ✅ New field
  columns:       [{ type: String, required: true }],
  technician:    { type: TechnicianSchema, required: true },
  entries:       [EntrySchema],
  timestamp:     { type: Date, default: Date.now }
});


module.exports = mongoose.model('MechanicalReport', MechanicalReportSchema);
