const mongoose = require("mongoose");

const assignmentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  assignedToId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  type: {
    type: String,
    enum: ["EPM", "MPM", "Service"],
    required: true,
  },
  status: {
    type: String,
    enum: ["Pending", "Assigned", "Completed"],
    default: "Pending",
  },
  assignedToName: String,
  assignedAt: {
    type: Date,
    default: Date.now,
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  assignedByName: String,
  year: Number,
  month: Number,
});

module.exports = mongoose.model("Assignment", assignmentSchema);