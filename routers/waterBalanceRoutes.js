const express = require("express");
const router = express.Router();
const {
  saveWaterBalance,
  getWaterBalance,
} = require("../controllers/waterBalanceController");

router.post("/water-balance", saveWaterBalance);
router.get(
  "/water-balance/:userName/:year/:month",
  getWaterBalance
);

module.exports = router;
