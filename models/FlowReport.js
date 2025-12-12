const mongoose = require("mongoose");

const readingSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },

    // Dynamic fields such as:
    // inlet_initial, inlet_final, inlet_comment, inlet_total
    // outlet_initial, outlet_final, outlet_comment, outlet_total
    // garden_initial, garden_final, garden_comment, garden_total
  },
  { strict: false, _id: false }
);

const flowReportSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    userName: { type: String, required: true, index: true },
    siteName: { type: String },

    year: { type: Number, required: true },
    month: { type: Number, required: true },
    flowMeters: {
  type: [String],
  default: ["Inlet", "Outlet"]
},

    readings: [readingSchema], // Now accepts unlimited dynamic meters
  },
  { timestamps: true }
);

// Prevent duplicate month
flowReportSchema.index({ userId: 1, year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model("FlowReport", flowReportSchema);
