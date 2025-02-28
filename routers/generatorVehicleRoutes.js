const express = require('express');
const router = express.Router();
const generatorVehicleController = require('../controllers/generatorVehicleController');

// Route to add a generator or vehicle entry
router.post('/addEntry', generatorVehicleController.addGeneratorVehicle);

// Route to fetch all entries
router.get('/getAllEntries', generatorVehicleController.getAllEntries);

module.exports = router;
