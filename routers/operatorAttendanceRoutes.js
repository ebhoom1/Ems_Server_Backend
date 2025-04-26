const express = require("express");
const router = express.Router();
const { markAttendance,markCheckOut } = require("../controllers/operatorAttendanceController");

router.post("/attendance", markAttendance);
router.put("/attendance/checkout", markCheckOut);

module.exports = router;