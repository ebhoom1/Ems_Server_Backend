// const mongoose = require("mongoose");

// const attendanceSchema = new mongoose.Schema({
//   username: { type: String, required: true },
//   companyName: { type: String},
//   adminType: { type: String, required: true },
//   checkInTime: { type: Date, required: true },
//   checkOutTime: { type: Date },
//   date: { type: String, required: true }, // YYYY-MM-DD
//   checkInMethod: { type: String, required: true },
//   latitude: { type: Number },
//   longitude: { type: Number },
//   userRole: {
//     type: String,
//     enum: ["operator", "technician", "territorialManager"],
//     required: true,
//   },
//   isCheckedIn: { type: Boolean, default: true } // ✅ Add this line

// });

// module.exports = mongoose.model("Attendance", attendanceSchema);

const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
  username: { type: String, required: true },
  companyName: { type: String },
  adminType: { type: String, required: true },
  checkInTime: { type: Date, required: true },
  checkOutTime: { type: Date },
  date: { type: String, required: true }, // YYYY-MM-DD
  checkInMethod: { type: String, required: true },
  latitude: { type: Number },
  longitude: { type: Number },
  userRole: {
    type: String,
    enum: ["operator", "technician", "territorialManager"],
    required: true,
  },
  isCheckedIn: { type: Boolean, default: true },
  photoBase64: { type: String }, // 📸 base64 image string
});

module.exports = mongoose.model("Attendance", attendanceSchema);