const mongoose = require('mongoose');
const { Schema } = mongoose;

// Equipment sub‐schema (embedded)
const EquipmentSchema = new Schema({
  name:      { type: String, required: true },
  model:     { type: String },
  capacity:  { type: String },
  ratedLoad: { type: String }
}, { _id: false });

// Each “response” sub‐schema
const ResponseSchema = new Schema({
  actual:       { type: String, default: "" },
  RY:           { type: String, default: "" },
  YB:           { type: String, default: "" },
  BR:           { type: String, default: "" },
  R:            { type: String, default: "" },
  Y:            { type: String, default: "" },
  B:            { type: String, default: "" },
  remark:       { type: String, default: "" },
  remarkStatus: { type: String, default: "" }
}, { _id: false });

// Technician sub‐schema
const TechnicianSchema = new Schema({
  name:        { type: String, required: true },
  designation: { type: String, default: "" },
  email:       { type: String, required: true }
}, { _id: false });

const ElectricalReportSchema = new Schema({
  equipmentId: {
    type: Schema.Types.ObjectId,
    ref: 'Equipment',
    required: true
  },
  technician:  { type: TechnicianSchema, required: true },
  equipment:   { type: EquipmentSchema,  required: true },
  responses:   { type: Map, of: ResponseSchema, required: true },
  userName:    { type: String, required: true, index: true },    // ← new field
  createdAt:   { type: Date,   default: Date.now }
});

module.exports = mongoose.model('ElectricalReport', ElectricalReportSchema);
