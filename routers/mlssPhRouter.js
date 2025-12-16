const express = require("express");
const router = express.Router();

const {
  saveOrUpdateReport,
  getMonthlyReport
} = require("../controllers/mlssPhController");

/* Save /Update*/
router.post("/mlss-ph", saveOrUpdateReport);

/* Fetch */
router.get(
  "/mlss-ph/:userName/:year/:month",
  getMonthlyReport
);

module.exports = router;
