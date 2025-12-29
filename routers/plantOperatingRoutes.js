const express = require("express");
const router = express.Router();

const {
  savePlantOperatingReport,
  getPlantOperatingReport,
} = require("../controllers/plantOperatingController");

// SAVE
router.post("/plant-operating", savePlantOperatingReport);

// GET
router.get(
  "/plant-operating/:userName/:month",
  getPlantOperatingReport
);

module.exports = router;
