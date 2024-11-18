const express = require('express');
const { 
    getCalibrationExceedValues,
    AddCalibrationExceedValues,
    editCalibrationExceedValues,
    deleteCalibrationExceedValues,
    getAllCalibrationExceedValues,
    getCalibrationExceedValuesByIndustryType
 } = require('../controllers/calibrationExceedValues');

const router = express.Router();

// Add Calibration Exceed Values 
router.post('/add-calibration-values', AddCalibrationExceedValues);

//Get All Calibration Exceed Values
router.get('/get-all-calibration-values',getAllCalibrationExceedValues);

// Get the Calibration Exceed values by userName
router.get('/get-calibration-values/:userName', getCalibrationExceedValues);

// Get the Calibration Exceed values by IndustryType
router.get('/get-calibration-values-industryType/:industryType',getCalibrationExceedValuesByIndustryType)

// Edit the Calibration Exceed Value by userName
router.patch('/edit-calibration-values/:userName',editCalibrationExceedValues);

//Delete the Calibration Exceed Value by _id
router.delete('/delete-calibration-values/:_id', deleteCalibrationExceedValues);

module.exports = router;
