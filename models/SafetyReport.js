const mongoose = require("mongoose");
const { Schema } = mongoose;

const SafetyChecklistSchema = new Schema({
  workplaceCondition: Boolean,
  safetyPPEs: Boolean,
  operatorsGrooming: Boolean,
  safetyEquipments: Boolean,
}, { _id: false });

const SafetyReportSchema = new Schema({
  equipmentId: { type: Schema.Types.ObjectId, ref: "Equipment", required: true },
  equipmentName: { type: String, required: true },
  customerName: { type: String, required: true },

  refNo: { type: String },
  date: { type: Date, default: Date.now },
  plantName: { type: String },
  capacity: { type: String },
  engineerName: { type: String, required: true },

  checklist: { type: SafetyChecklistSchema, default: {} },
  observation: { type: String },
  customerRemarks: { type: String },

  customerSignatureImage: { type: String },
  engineerSignatureImage: { type: String },

  photos: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("SafetyReport", SafetyReportSchema);
