const express = require('express');
const router = express.Router();
const fuelController = require('../controllers/fuelController');

// Route to add a new fuel entry
router.post('/add', fuelController.addFuelEntry);

// Route to get all fuel entries
router.get('/fuel/all', fuelController.getAllFuelEntries);

// Route to get fuel entries by user
router.get('/fuel/user/:userName', fuelController.getFuelEntriesByUser);

// Route to delete a fuel entry by ID
router.delete('/delete/:id', fuelController.deleteFuelEntry);

module.exports = router;
