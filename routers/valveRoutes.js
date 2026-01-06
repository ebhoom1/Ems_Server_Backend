const express = require("express");
const router = express.Router();
const valveStateController = require("../controllers/valveStateController");

router.get("/valve-states/:productId", valveStateController.getValveStates);

module.exports = router;
