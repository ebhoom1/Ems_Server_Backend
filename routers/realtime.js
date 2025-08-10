// routes/realtime.js
const express = require('express');
const router = express.Router();
const realtimeController = require('../controllers/realtimeController');

// Route to get real-time pump status for a specific product ID
router.get('/realtime-pump-status/:productId', realtimeController.getRealtimePumpStatus);

module.exports = router;