const express = require('express');
const router = express.Router();
const { setPrimaryStation,getPrimaryStation } = require('../controllers/primaryStationController');

// Route to set primary station
router.post('/set-primary-station', setPrimaryStation);

// Route to get primary station by userName
router.get('/primary-station/:userName', getPrimaryStation);

module.exports = router;
