const express = require("express");
const router = express.Router();
const {
  saveChemicalReport,
  getChemicalReport
} = require("../controllers/chemicalReportController");

router.post("/", saveChemicalReport);
router.get("/:userName/:year/:month", getChemicalReport);
module.exports = router;
