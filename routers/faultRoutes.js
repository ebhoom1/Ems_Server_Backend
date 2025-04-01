const express = require('express');
const router = express.Router();
const faultController = require('../controllers/faultController');

router.post('/report-fault', faultController.addFault);
router.get('/all-faults', faultController.getAllFaults);
router.put('/update-fault/:id', faultController.updateFaultStatus);
router.get('/fault-user/:username', faultController.getFaultsByUsername);
router.get('/admin-type-fault/:adminType', faultController.getFaultsByAdminType);
module.exports = router;
