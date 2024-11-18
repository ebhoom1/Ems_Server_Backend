const express = require('express')
const {addCalibration,
       viewAllCalibrations,
       findCalibrationByUserName,
       editCalibration,
       deleteCalibration,
       checkAndSendNotification
} = require('../controllers/calibration')

const router = express.Router()

// Add calibration
router.post('/add-calibration', addCalibration);

// Edit calibration
router.patch('/edit-calibration/:userName', editCalibration);

// View all calibrations
router.get('/view-all-calibrations', viewAllCalibrations);

// Delete calibration
router.delete('/delete-calibration/:id', deleteCalibration);

// Find calibration by userId
router.get('/find-calibration-by-userId/:userName', findCalibrationByUserName);



module.exports=router;