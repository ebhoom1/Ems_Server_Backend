const express = require("express");
const router = express.Router();

const {
  saveCriticalSpareReport,
  getCriticalSpareReport,
} = require("../controllers/criticalSpareReportController");

/* SAVE */
router.post("/", saveCriticalSpareReport);

/* FETCH */
router.get("/:userName/:year/:month", getCriticalSpareReport);

module.exports = router;
