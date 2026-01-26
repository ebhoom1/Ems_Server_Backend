// FILE: routes/equipmentStatusWeeklyRoutes.js
const express = require("express");
const {
  getEquipmentStatusWeeklyReport,
  saveOrUpdateEquipmentStatusWeeklyReport,
} = require("../controllers/equipmentStatusWeeklyController");

const router = express.Router();

// GET week report
router.get("/:userId/:year/:month/:week", getEquipmentStatusWeeklyReport);

// POST upsert week report
router.post("/", saveOrUpdateEquipmentStatusWeeklyReport);

module.exports = router;
