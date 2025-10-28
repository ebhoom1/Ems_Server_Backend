
// models/ServiceReport.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const TechnicianSchema = new Schema({
  name:  { type: String, required: true },
  email: { type: String, required: true }
}, { _id: false });

const EquipmentDetailsSchema = new Schema({
  name: { type: String },
  capacity: { type: String },
  make: { type: String },
  description: { type: String }
}, { _id: false });

const SubmittedBySchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  role:   { type: String, enum: ['Technician', 'TerritorialManager'], required: true },
  name:   { type: String, required: true },
  email:  { type: String, required: true }
}, { _id: false });

const HeaderSchema = new Schema({
  site:            { type: String },
  date:            { type: Date },
  reportNo:        { type: String },
  // NEW: store Plant Capacity here; keep legacy below for back-compat
  plantCapacity:   { type: String },
  areaOfInspection:{ type: String }, // legacy, we mirror plantCapacity into this
  reference:       { type: String },
  incidentDate:    { type: String },
  typeOfService:   { type: String },
  analyzedBy:      { type: String }, // no longer set, but kept for legacy
  preparedBy:      { type: String }
}, { _id: false });

const ServiceReportSchema = new Schema({
  equipmentId: { type: Schema.Types.ObjectId, ref: 'Equipment', required: true },
  equipmentName: { type: String, required: true },
  userName: { type: String, required: true, index: true },

  reportDate: { type: Date, default: Date.now },

  technician: { type: TechnicianSchema, required: true },

  submittedBy: { type: SubmittedBySchema, required: true },
  submittedAt: { type: Date, default: Date.now },

  header: { type: HeaderSchema, default: {} },

  equipmentDetails: { type: EquipmentDetailsSchema },
  detailsOfServiceDone: { type: String },

  equipmentWorkingStatus: { type: String, enum: ['Normal conditions', 'Not working'], default: 'Normal conditions' },
  suggestionsFromEngineer: { type: String },
  customerRemarks: { type: String },
  classificationCode: { type: String },

  issueReported: { type: String },
  issuePhotos:   [{ type: String }],
  beforeImages:  [{ type: String }],
  beforeCaptions:[{ type: String }],
  afterImages:   [{ type: String }],
  afterCaptions: [{ type: String }],

  photos: [{ type: String }],

  // typed signatures (legacy)
  customerSignoffText: { type: String },
  technicianSignatureText: { type: String },

  // NEW: drawn signature image URLs
  customerSignatureImageUrl: { type: String },
  technicianSignatureImageUrl: { type: String },
  
  customerSigName: { type: String },
customerSigDesignation: { type: String },
technicianSigName: { type: String },
technicianSigDesignation: { type: String },


  // legacy extras
  issueDescription: { type: String },
  actionTaken: { type: String },
  sparesUsed: { type: String },
  isResolved: { type: Boolean, default: false },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ServiceReport', ServiceReportSchema);
