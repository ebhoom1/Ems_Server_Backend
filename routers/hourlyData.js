const express = require ('express');
const {
    getHourlyDataOfCumulatingFlowAndEnergy ,
    getLastEffluentHourlyByUserName
} = require('../controllers/saveHourlyData');

const router = express.Router()

// Define the route for getting getHourlyDataOfCumulatingFlowAndEnergy 
router.get('/hourly-data', getHourlyDataOfCumulatingFlowAndEnergy );
router.get('/hourly/effluent/last', getLastEffluentHourlyByUserName);
module.exports = router;