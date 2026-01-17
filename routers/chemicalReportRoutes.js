const express = require("express");
const router = express.Router();
const {
  saveMonthlyChemicalReport,
  getMonthlyChemicalReport,
} = require("../controllers/chemicalReportController");

router.post("/", saveMonthlyChemicalReport);
router.get("/:userName/:year/:month", getMonthlyChemicalReport);

module.exports = router;
