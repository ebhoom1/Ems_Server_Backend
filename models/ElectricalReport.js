// models/ElectricalReport.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

// Equipment sub‐schema (embedded)
const EquipmentSchema = new Schema({
  name:      { type: String, required: true },
  model:     { type: String },
  capacity:  { type: String },
  ratedLoad: { type: String }
}, { _id: false });

// Each “response” sub‐schema: holds numeric measurements (if applicable),
// free‐text remark, and a “remarkStatus” for rows that use ✓/✕.
const ResponseSchema = new Schema({
  // For rows 1–3 (measurement): these fields may be empty for rows 4–8
  actual:      { type: String, default: "" },
  RY:          { type: String, default: "" },
  YB:          { type: String, default: "" },
  BR:          { type: String, default: "" },

  // For row 2 (Current), we also store “R”, “Y”, “B” as strings:
  R:           { type: String, default: "" },
  Y:           { type: String, default: "" },
  B:           { type: String, default: "" },

  // Free‐text remark (used by all rows: measurement rows (1–3) and remark‐only rows (4–8))
  remark:      { type: String, default: "" },

  // “pass” / “fail” / "" (the ✓/✕ status), only relevant for rows 4–8;
  // left empty for measurement rows 1–3 if you don’t use it there.
  remarkStatus: { type: String, default: "" }
}, { _id: false });

// Technician sub‐schema
const TechnicianSchema = new Schema({
  name:        { type: String, required: true },
  designation: { type: String, required: true },
  email:       { type: String, required: true }
}, { _id: false });

const ElectricalReportSchema = new Schema({
  equipmentId: {
    type: Schema.Types.ObjectId,
    ref: 'Equipment',
    required: true
  },
  technician: { type: TechnicianSchema, required: true },
  equipment:  { type: EquipmentSchema,  required: true },

  // We use a Map of ResponseSchema, keyed by row ID (as a string).
  // e.g. responses.get("1") is the Voltage‐row response, responses.get("4") is row 4, etc.
  responses: { type: Map, of: ResponseSchema, required: true },

  createdAt:  { type: Date, default: Date.now }
});

module.exports = mongoose.model('ElectricalReport', ElectricalReportSchema);
