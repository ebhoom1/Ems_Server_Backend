const express = require("express");
const router = express.Router();
const {
  markAttendance,
  markCheckOut,
  getCheckInStatus,
  getAllAttendances,
  getAttendanceByUserName,
  getAttendanceByAdminType
} = require("../controllers/attendanceController");
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/attendance", upload.single("photoBase64"), markAttendance);
router.put("/attendance/checkout", markCheckOut);
router.get('/attendance/status/:username/:userRole', getCheckInStatus);
router.get("/attendance/all", getAllAttendances);
router.get("/attendance/user/:username", getAttendanceByUserName);
router.get("/attendance/admin/:adminType", getAttendanceByAdminType);

module.exports = router;