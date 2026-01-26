// FILE: routes/criticalSpareWeeklyRoutes.js
const express = require("express");
const router = express.Router();

const {
  saveCriticalSpareWeeklyReport,
  getCriticalSpareWeeklyReport,
} = require("../controllers/criticalSpareWeeklyReportController");

/* SAVE */
router.post("/", saveCriticalSpareWeeklyReport);

/* FETCH */
router.get("/:userName/:year/:month/:week", getCriticalSpareWeeklyReport);

module.exports = router;
