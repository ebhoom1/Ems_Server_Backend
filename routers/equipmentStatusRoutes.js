// FILE: routers/equipmentStatusRoutes.js
const express = require("express");
const {
  getEquipmentStatusReport,
  saveOrUpdateEquipmentStatusReport,
} = require("../controllers/equipmentStatusController");

const router = express.Router();

router.get("/:userId/:year/:month", getEquipmentStatusReport);
router.post("/", saveOrUpdateEquipmentStatusReport);

module.exports = router;
