const Attendance = require("../models/OperatoraAttendanceModel");

// POST /api/attendance
const markAttendance = async (req, res) => {
  try {
    const { username, companyName, adminType,checkInTime, checkInMethod } = req.body; 

    if (!username || !companyName || !adminType||!checkInTime || !checkInMethod) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const date = new Date(checkInTime).toISOString().split("T")[0]; // "YYYY-MM-DD"

    const newAttendance = new Attendance({
      username,
      companyName,
      adminType,
      checkInTime,
      checkInMethod, 
      date
    });

    await newAttendance.save();
    res.status(201).json({ message: "Attendance marked successfully" });
  } catch (error) {
    console.error("Error marking attendance:", error);
    res.status(500).json({ message: "Server error" });
  }
};


const markCheckOut = async (req, res) => {
  try {
    const { username, checkOutTime } = req.body;
    const date = new Date().toISOString().split("T")[0];

    const updated = await Attendance.findOneAndUpdate(
      { username, date },
      { checkOutTime }, 
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "No active check-in found for today." });
    }

    res.status(200).json({ message: "Check-out time updated.", data: updated });
  } catch (err) {
    console.error("Error marking checkout:", err);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { markAttendance ,markCheckOut};