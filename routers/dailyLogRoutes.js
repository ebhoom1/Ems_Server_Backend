const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/dailyLogController');

// POST   /api/dailyLogs       → create a log
router.post('/add-dailylog',        ctrl.createDailyLog);

// GET    /api/dailyLogs       → list all logs
router.get('/getdailylog',         ctrl.getDailyLogs);

// GET    /api/dailyLogs/:id   → one log by ID
router.get('/getdailyLogById:id',      ctrl.getDailyLogById);

// PUT    /api/dailyLogs/:id   → update
router.put('/updateDailyLogById:id',      ctrl.updateDailyLog);

// DELETE /api/dailyLogs/:id   → delete
router.delete('/delete-dailyLogById:id',   ctrl.deleteDailyLog);

router.get('/getdailylogByUsername/:username', ctrl.getDailyLogsByUsername);
module.exports = router;
