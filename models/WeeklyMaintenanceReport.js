// FILE: models/WeeklyMaintenanceReport.js
const mongoose = require("mongoose");

const PhotoSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    type: { type: String, enum: ["MPM", "EPM", "GENERAL"], default: "MPM" },
  },
  { _id: false }
);

const EntrySchema = new mongoose.Schema(
  {
    date: { type: String, required: true }, // yyyy-mm-dd
    comment: { type: String, default: "" },
    photos: { type: [String], default: [] }, // ✅ store urls only
  },
  { _id: false }
);

const WeeklyMaintenanceReportSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Monday of that week: yyyy-mm-dd
    weekStart: { type: String, required: true, index: true },

    entries: { type: [EntrySchema], default: [] },
  },
  { timestamps: true }
);

WeeklyMaintenanceReportSchema.index({ userId: 1, weekStart: 1 }, { unique: true });

module.exports = mongoose.model("WeeklyMaintenanceReport", WeeklyMaintenanceReportSchema);
