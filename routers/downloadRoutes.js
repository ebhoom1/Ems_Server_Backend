const express = require('express');
const router = express.Router();
const { downloadPumpData, downloadTankData } = require('../controllers/downloadController');

// Route to download pump metrics data
// Access this via: GET http://<your_server_address>/api/download/pump-metrics
router.get('/download/pump-metrics', downloadPumpData);

// Route to download tank data
// Access this via: GET http://<your_server_address>/api/download/tank-data
router.get('/download/tank-data', downloadTankData);

module.exports = router;
