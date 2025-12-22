const express = require("express");
const router = express.Router();
const {
  savePowerConsumption,
  getPowerConsumption,
} = require("../controllers/powerConsumptionController");

router.post("/power-consumption", savePowerConsumption);
router.get(
  "/power-consumption/:userName/:year/:month",
  getPowerConsumption
);

module.exports = router;
