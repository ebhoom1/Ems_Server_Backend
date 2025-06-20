// routes/hourlyRoutes.js
const express = require('express');
const {
  getHourlyDataOfCumulatingFlowAndEnergy,
  getLastEffluentHourlyByUserName,
  getLastEnergyHourlyByUserName,
  getTodaysHourlyDataByUserFromS3,
  getDailyEffluentAveragesByUser,
  getDailyEffluentAverages90Days
} = require('../controllers/saveHourlyData');

const router = express.Router();

// GET hourly data (cumulatingFlow + energy) from Mongo or S3
router.get('/hourly-data', getHourlyDataOfCumulatingFlowAndEnergy);

// GET the last effluent_flow stacks for a user from S3
router.get('/hourly/effluent/last', getLastEffluentHourlyByUserName);

// GET the last energy stacks for a user from S3
router.get('/hourly/energy/last', getLastEnergyHourlyByUserName);

// GET today's hourly data for a user from S3
router.get('/hourly/today', getTodaysHourlyDataByUserFromS3);

// GET daily average cumulating flow for each effluent_flow stack, for a given user
// e.g. /daily/effluent-averages?userName=EGL1&days=20
router.get('/daily/effluent-averages', getDailyEffluentAveragesByUser);

router.get('/daily/effluent-averages/90days', getDailyEffluentAverages90Days);

module.exports = router;
