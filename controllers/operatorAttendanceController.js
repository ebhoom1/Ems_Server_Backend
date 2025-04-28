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

// ✅ GET - All Attendances
const getAllAttendances = async (req, res) => {
  try {
    const attendances = await Attendance.find().sort({ createdAt: -1 });
    res.status(200).json({ message: "All attendances fetched successfully", data: attendances });
  } catch (error) {
    console.error("Error fetching all attendances:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ GET - Attendances by UserName
const getAttendanceByUserName = async (req, res) => {
  try {
    const { username } = req.params;

    if (!username) {
      return res.status(400).json({ message: "Username is required." });
    }

    const attendances = await Attendance.find({ username }).sort({ createdAt: -1 });

    if (attendances.length === 0) {
      return res.status(404).json({ message: "No attendance records found for this user." });
    }

    res.status(200).json({ message: "User attendance fetched successfully", data: attendances });
  } catch (error) {
    console.error("Error fetching user attendance:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ GET - Attendances by AdminType
const getAttendanceByAdminType = async (req, res) => {
  try {
    const { adminType } = req.params;

    if (!adminType) {
      return res.status(400).json({ message: "Admin type is required." });
    }

    const attendances = await Attendance.find({ adminType }).sort({ createdAt: -1 });

    if (attendances.length === 0) {
      return res.status(404).json({ message: "No attendance records found for this admin type." });
    }

    res.status(200).json({ message: "Admin type attendances fetched successfully", data: attendances });
  } catch (error) {
    console.error("Error fetching admin type attendance:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  markAttendance,
  markCheckOut,
  getAllAttendances,
  getAttendanceByUserName,
  getAttendanceByAdminType
};