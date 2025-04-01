// routes/inventory.js
const express = require("express");
const router = express.Router();
const inventoryController = require("../controllers/inventoryController");

// Route to add inventory item
router.post("/add", inventoryController.addInventoryItem);
router.get("/inventory/get", inventoryController.getInventoryItems);
router.get("/user", inventoryController.getInventoryByUser);
// New route to add a usage log
router.post("/use", inventoryController.addInventoryUsage);

// New route to get usage logs (optionally filtered by SKU)
// Example: GET /api/inventory/use?sku=PumpParts-123
router.get("/use", inventoryController.getInventoryUsage);
router.get("/left", inventoryController.getLeftQuantity);
router.get('/admin-type-usage/:adminType', inventoryController.getInventoryUsageByAdminType);
router.get('/admin-type-inventory/:adminType', inventoryController.getInventoryByAdminType);
module.exports = router;
