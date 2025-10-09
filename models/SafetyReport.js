

const mongoose = require("mongoose");
const { Schema } = mongoose;

const SafetyChecklistSchema = new Schema({
  workplaceCondition: Boolean,
  safetyPPEs: Boolean,
  operatorsGrooming: Boolean,
  safetyEquipments: Boolean,
}, { _id: false });

const SafetyReportSchema = new Schema({
  customerName: { type: String, required: true },
  refNo: { type: String },
  date: { type: Date, default: Date.now },
  plantName: { type: String },
  capacity: { type: String },
  engineerName: { type: String, required: true },

  checklistType: { type: String, enum: ["SBR", "ASP", "MBR"], required: true },
  dynamicChecklist: { type: Object, default: {} }, // ✅ NEW
checklist: { type: SafetyChecklistSchema, default: {} },
  auditDetails: { type: String },
  observation: { type: String },
  engineerRemarks: { type: String },
  customerRemarks: { type: String },

  customerSigName: { type: String },
  customerSigDesignation: { type: String },
  engineerSigName: { type: String },
  engineerSigDesignation: { type: String },

  customerSignatureImage: { type: String },
  engineerSignatureImage: { type: String },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("SafetyReport", SafetyReportSchema);
