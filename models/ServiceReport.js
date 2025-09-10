// // models/ServiceReport.js
// const mongoose = require('mongoose');
// const { Schema } = mongoose;

// const TechnicianSchema = new Schema({
//   name:  { type: String, required: true },
//   email: { type: String, required: true }
// }, { _id: false });

// const EquipmentDetailsSchema = new Schema({
//   name: { type: String },
//   capacity: { type: String },
//   make: { type: String },
//   description: { type: String }
// }, { _id: false });

// const ServiceReportSchema = new Schema({
//   equipmentId: { type: Schema.Types.ObjectId, ref: 'Equipment', required: true },
//   equipmentName: { type: String, required: true },
//   userName: { type: String, required: true, index: true },
//   reportDate: { type: Date, default: Date.now },
//   technician: { type: TechnicianSchema, required: true },

//   equipmentDetails: { type: EquipmentDetailsSchema },
//   detailsOfServiceDone: { type: String },
//   equipmentWorkingStatus: { type: String, enum: ['Normal conditions', 'Not working'], default: 'Normal conditions' },
//   suggestionsFromEngineer: { type: String },
//   customerRemarks: { type: String },
//   classificationCode: { type: String },

//   // Fields from previous iteration (keeping them as per prior discussions, remove if truly obsolete)
//   issueDescription: { type: String },
//   actionTaken: { type: String },
//   sparesUsed: { type: String },
//   isResolved: { type: Boolean, default: false },

//   photos: [{ type: String }], // Still for general photo uploads
//   customerSignoffText: { type: String }, // NEW: For typed customer signature
//   technicianSignatureText: { type: String }, // NEW: For typed technician signature
//   createdAt: { type: Date, default: Date.now },
// });

// module.exports = mongoose.model('ServiceReport', ServiceReportSchema);


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

const ServiceReportSchema = new Schema({
  equipmentId: { type: Schema.Types.ObjectId, ref: 'Equipment', required: true },
  equipmentName: { type: String, required: true },
  userName: { type: String, required: true, index: true },

  reportDate: { type: Date, default: Date.now },
  // kept for backward-compatibility
  technician: { type: TechnicianSchema, required: true },

  // NEW: who actually submitted this report (tech or TM)
  submittedBy: { type: SubmittedBySchema, required: true },
  submittedAt: { type: Date, default: Date.now },

  equipmentDetails: { type: EquipmentDetailsSchema },
  detailsOfServiceDone: { type: String },
  equipmentWorkingStatus: { type: String, enum: ['Normal conditions', 'Not working'], default: 'Normal conditions' },
  suggestionsFromEngineer: { type: String },
  customerRemarks: { type: String },
  classificationCode: { type: String },

  // legacy fields
  issueDescription: { type: String },
  actionTaken: { type: String },
  sparesUsed: { type: String },
  isResolved: { type: Boolean, default: false },

  photos: [{ type: String }],
  customerSignoffText: { type: String },
  technicianSignatureText: { type: String },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ServiceReport', ServiceReportSchema);