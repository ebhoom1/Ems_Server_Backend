const Attendance = require("../models/attendanceModel");

const markAttendance = async (req, res) => {
    try {
      // give companyName a default of empty string if it's not sent
      const {
        username,
        companyName = "",
        adminType,
        checkInTime,
        checkInMethod,
        latitude,
        longitude,
        userRole,
        isCheckedIn
      } = req.body;
  
      // only validate the truly required fields
      if (!username || !adminType || !checkInTime || !checkInMethod || !userRole) {
        return res.status(400).json({
          message: "Missing required fields: username, adminType, checkInTime, checkInMethod or userRole"
        });
      }
  
      const date = new Date(checkInTime).toISOString().split("T")[0];
  
      const newAttendance = new Attendance({
        username,
        companyName,   // will be "" if client didn’t send it
        adminType,
        checkInTime,
        checkInMethod,
        latitude,
        longitude,
        date,
        userRole,
        isCheckedIn
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
      const { username, checkOutTime, userRole } = req.body;
  
      if (!username || !checkOutTime || !userRole) {
        return res.status(400).json({ message: "Missing required fields: username, userRole, or checkOutTime" });
      }
  
      const latestAttendance = await Attendance.findOne({
        username,
        userRole,
        checkOutTime: { $exists: false }
      }).sort({ checkInTime: -1 });
  
      if (!latestAttendance) {
        return res.status(404).json({ message: "No active check-in found for this role to check-out." });
      }
  
      latestAttendance.checkOutTime = checkOutTime;
      latestAttendance.isCheckedIn = false; // ✅ This line ensures it's marked as not checked in
      console.log("Updating attendance:", {
        checkOutTime,
        isCheckedIn: latestAttendance.isCheckedIn
      });
      
      await latestAttendance.save();
  
      res.status(200).json({ message: "Check-out successful", data: latestAttendance });
    } catch (error) {
      console.error("Error during check-out:", error);
      res.status(500).json({ message: "Server error" });
    }
  };
  
  

  const getCheckInStatus = async (req, res) => {
    const { username, userRole } = req.params;
  
    try {
      // Find the latest attendance entry for the user and role
      const latest = await Attendance.findOne({
        username,
        userRole,
      }).sort({ checkInTime: -1 });
  
      const isCheckedIn = latest?.isCheckedIn ?? false;
  
      res.status(200).json({ isCheckedIn });
    } catch (err) {
      console.error("Status check error:", err);
      res.status(500).json({ message: "Error fetching check-in status" });
    }
  };
  

const getAllAttendances = async (req, res) => {
  try {
    const attendances = await Attendance.find().sort({ createdAt: -1 });
    res.status(200).json({ data: attendances });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const getAttendanceByUserName = async (req, res) => {
  try {
    const { username } = req.params;
    const records = await Attendance.find({ username }).sort({ checkInTime: -1 });
    res.status(200).json({ data: records });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const getAttendanceByAdminType = async (req, res) => {
  try {
    const { adminType } = req.params;
    const records = await Attendance.find({ adminType }).sort({ checkInTime: -1 });
    res.status(200).json({ data: records });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  markAttendance,
  markCheckOut,
  getCheckInStatus,
  getAllAttendances,
  getAttendanceByUserName,
  getAttendanceByAdminType
};