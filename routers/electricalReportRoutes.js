const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/electricalReportController');

router.post('/add-electricalreport',    ctrl.createReport);
router.get('/get-all-electricalreport',     ctrl.getAllReports);
router.get('/get-electricalreport/:id',  ctrl.getReportById);
router.delete('/delete-electricalreport/:id', ctrl.deleteReport);

module.exports = router;