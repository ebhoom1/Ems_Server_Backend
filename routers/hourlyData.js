const express = require ('express');
const {
    getHourlyDataOfCumulatingFlowAndEnergy 
} = require('../controllers/saveHourlyData');

const router = express.Router()

// Define the route for getting getHourlyDataOfCumulatingFlowAndEnergy 
router.get('/hourly-data', getHourlyDataOfCumulatingFlowAndEnergy );

module.exports = router;