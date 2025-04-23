const mongoose = require('mongoose');
const { Schema } = mongoose;

const EquipmentSchema = new Schema({
  name:      { type: String, required: true },
  model:     { type: String },
  capacity:  { type: String },
  ratedLoad: { type: String }
}, { _id: false });

const ResponseSchema = new Schema({
  actual: { type: String },
  RY:     { type: String },
  YB:     { type: String },
  BR:     { type: String },
  remark: { type: String }
}, { _id: false });

// New sub‐schema for technician
const TechnicianSchema = new Schema({
  name:        { type: String, required: true },
  designation: { type: String, required: true },
  email:       { type: String, required: true }
}, { _id: false });

const ElectricalReportSchema = new Schema({
  // <-- add this field
  equipmentId: {
    type: Schema.Types.ObjectId,
    ref: 'Equipment',
    required: true
  },

  technician: { type: TechnicianSchema, required: true },
  equipment:  { type: EquipmentSchema, required: true },
  responses:  { type: Map, of: ResponseSchema, required: true },
  createdAt:  { type: Date, default: Date.now }
});

module.exports = mongoose.model('ElectricalReport', ElectricalReportSchema);
