const express = require("express");
const router = express.Router();
const { reportSummary } = require("../controllers/reportSummary");

router.get("/summary/:month/:year", reportSummary);

module.exports = router;
