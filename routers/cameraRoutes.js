// routers/cameraRoutes.js

const express = require("express");
const router = express.Router();

const { getCameraList } = require("../controllers/cameraListController");

router.get("/cameras", getCameraList);

module.exports = router;
