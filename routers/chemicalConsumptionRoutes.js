const express = require("express");
const router = express.Router();
const {saveChemicalConsumption,getChemicalConsumption }= require("../controllers/chemicalConsumptionController");

router.post("/chemical-consumption", saveChemicalConsumption);
router.get(
  "/chemical-consumption/:userName/:year/:month",
  getChemicalConsumption
);

module.exports = router;
