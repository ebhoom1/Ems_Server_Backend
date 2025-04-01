// routes/requestInventory.js
const express = require("express");
const router = express.Router();
const requestInventoryController = require("../controllers/requestInventoryController");

router.post("/addrequest", requestInventoryController.addRequestInventory);
router.get("/getrequest", requestInventoryController.getRequestInventory);
router.put("/:id", requestInventoryController.updateRequestStatus);
router.get('/admin-type-request/:adminType', requestInventoryController.getRequestByAdminType);
router.get('/user-request/:username', requestInventoryController.getRequestByUsername);
module.exports = router;
