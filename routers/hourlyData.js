const express = require ('express');
const {
    getHourlyDataOfCumulatingFlowAndEnergy ,
    getLastEffluentHourlyByUserName,
    getLastEnergyHourlyByUserName,
} = require('../controllers/saveHourlyData');

const router = express.Router()

// Define the route for getting getHourlyDataOfCumulatingFlowAndEnergy 
router.get('/hourly-data', getHourlyDataOfCumulatingFlowAndEnergy );
router.get('/hourly/effluent/last', getLastEffluentHourlyByUserName);
router.get('/hourly/energy/last', getLastEnergyHourlyByUserName);

module.exports = router;