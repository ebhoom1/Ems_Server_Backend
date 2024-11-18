const express = require('express');
const { getSensorData } = require('../controllers/sensorController'); // Adjust the path as needed

const router = express.Router();

// Route to get sensor data for a specific range (day, week, month, etc.)
router.get('/sensor-data', getSensorData);

module.exports = router;
