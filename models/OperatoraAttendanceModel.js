const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
  username: { type: String, required: true },
  companyName: { type: String, required: true },
  adminType:{type: String, required: true },
  checkInTime: { type: Date, required: true },
  checkOutTime: { type: Date }, 
  date: { type: String, required: true },// "YYYY-MM-DD" for easy lookup
  checkInMethod: { type: String, required: true }
});

module.exports = mongoose.model("Attendance", attendanceSchema); 