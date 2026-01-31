const express = require("express");
const router = express.Router();
const controller = require("../controllers/chemicalReportV2Controller");

router.post("/chemical-report-v2", controller.saveReport);
router.get("/chemical-report-v2/:userName/:year/:month", controller.getReport);

module.exports = router;