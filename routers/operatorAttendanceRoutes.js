const express = require("express");
const router = express.Router();
const { 
  markAttendance, 
  markCheckOut, 
  getAllAttendances, 
  getAttendanceByUserName, 
  getAttendanceByAdminType 
} = require("../controllers/operatorAttendanceController");

router.post("/attendance", markAttendance);
router.put("/attendance/checkout", markCheckOut);
router.get("/attendance/all", getAllAttendances);
router.get("/attendance/user/:username", getAttendanceByUserName);
router.get("/attendance/admin/:adminType", getAttendanceByAdminType);

module.exports = router;