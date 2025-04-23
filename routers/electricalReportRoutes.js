const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/electricalReportController');

router.post(
  '/add-electricalreport',
  ctrl.createReport
);

router.get(
  '/get-electricalreport/:equipmentId',
  ctrl.getReportByEquipment
);

router.get(
  '/all-electricalreports',
  ctrl.getAllReports
);

router.delete(
  '/delete-electricalreport/:id',
  ctrl.deleteReport
);

module.exports = router;
