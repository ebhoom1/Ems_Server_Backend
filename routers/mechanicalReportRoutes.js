const express = require('express');
const router = express.Router();
const {
  addMechanicalReport,
  getMechanicalReports,
  getReportsByEquipment
} = require('../controllers/mechanicalReportController');

// Create a new report
router.post('/add-mechanicalreport', addMechanicalReport);

// Fetch all reports
router.get('/mechanicalreports', getMechanicalReports);

router.get('/mechanicalreports/:equipmentId', getReportsByEquipment);
module.exports = router;