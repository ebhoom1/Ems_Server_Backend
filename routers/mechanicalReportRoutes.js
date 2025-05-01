const express = require('express');
const router = express.Router();
const {
  addMechanicalReport,
  getMechanicalReports,
  getReportsByEquipment,
  getReportsByMonth
} = require('../controllers/mechanicalReportController');

// Create a new report
router.post('/add-mechanicalreport', addMechanicalReport);

// Fetch all reports
router.get('/mechanicalreports', getMechanicalReports);

router.get('/mechanicalreports/:equipmentId', getReportsByEquipment);
router.get (
  '/mechanicalreports/month/:year/:month',
  getReportsByMonth
);
module.exports = router;