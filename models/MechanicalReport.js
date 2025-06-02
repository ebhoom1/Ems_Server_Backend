const mongoose = require('mongoose');

// Sub-schema for technician details
const TechnicianSchema = new mongoose.Schema({
  name:        { type: String, },
  designation: { type: String,  },
  email:       { type: String,  }
});

// Sub-schema for individual checklist checks
const CheckSchema = new mongoose.Schema({
  column: { type: String },
  value:  { type: String, default: '' }
});

// Sub-schema for each maintenance entry
const EntrySchema = new mongoose.Schema({
  id:          { type: Number, required: true },
  category:    { type: String, required: true },
  description: { type: String, default: '' },
  checks:      [CheckSchema],
  remarks:     { type: String, default: '' }
});

// Main schema for mechanical reports
const MechanicalReportSchema = new mongoose.Schema({
  equipmentId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Equipment', required: true },
  equipmentName: { type: String, required: true },
  userName:      { type: String, required: true },
  capacity:      { type: String, default: '' },
  columns:       [{ type: String }],
  technician:    { type: TechnicianSchema, required: true },
  entries:       [EntrySchema],
  timestamp:     { type: Date, default: Date.now },
  isWorking:     { type: String, enum: ['yes','no'], default: 'yes' },
  comments:      { type: String, default: '' },
  photos:        [{ type: String }]  // store S3 URLs instead of binary buffers
});

module.exports = mongoose.model('MechanicalReport', MechanicalReportSchema);
