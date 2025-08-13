const express = require('express');
const router = express.Router();
const { getDailyPumpRuntime,
    getRuntimeHistory,
  getRuntimePumps,
 } = require('../controllers/pumpRuntimeController');

// GET runtime for all pumps on a given date
router.get('/runtime/:product_id/:userName/:date', getDailyPumpRuntime);
router.get('/runtime/history', getRuntimeHistory);

router.get('/runtime/pumps/:product_id/:userName', getRuntimePumps);

module.exports = router;