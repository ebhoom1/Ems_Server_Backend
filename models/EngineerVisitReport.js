const mongoose = require('mongoose');
const { Schema } = mongoose;

const ParametersSchema = new Schema({
  phRaw: String,
  phTreated: String,
  mlss: String,
  frc: String,
  tds: String,
  hardness: String,
}, { _id: false });

const KeyPointsSchema = new Schema({
  logBookEntry: Boolean,
  historyCards: Boolean,
  grooming: Boolean,
  housekeeping: Boolean,
  training: Boolean,
  checklist: Boolean,
  noticeBoard: Boolean,
}, { _id: false });

const ConsumablesSchema = new Schema({
  sodiumHypo: String,
  blowerOil: String,
  pumpOil: String,
  ppeStock: String,
  antiscalant: String,
  salt: String,
  cottonWaste: String,
  grease: String,
}, { _id: false });

  const EngineerVisitReportSchema = new Schema({
  customerName: { type: String, required: true },

  referenceNo: { type: String },   // ✅ updated
  date: { type: Date, default: Date.now },
  engineerName: { type: String, required: true },

  plantCapacity: { type: String },
  technology: { type: String },
  parameters: { type: ParametersSchema, default: {} },
  keyPoints: { type: KeyPointsSchema, default: {} },
  consumables: { type: ConsumablesSchema, default: {} },

  visitDetails: { type: String },
  engineerRemarks: { type: String },
  customerRemarks: { type: String },

  customerSignatureImage: { type: String },
  engineerSignatureImage: { type: String },

  customerSigName: { type: String },        // ✅ new
  customerSigDesignation: { type: String }, // ✅ new
  engineerSigName: { type: String },        // ✅ new
  engineerSigDesignation: { type: String }, // ✅ new

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('EngineerVisitReport', EngineerVisitReportSchema);
