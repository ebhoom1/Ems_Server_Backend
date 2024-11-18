const express = require('express');
const router = express.Router();
const {
    getAllPredictionData,
    getPredictionDataByUserName,
    getPredictionDataByUserNameAndStackName,
    getPredictionDataByUserNameAndStackNameAndInterval,
} = require('../controllers/predictionController');
const {getPredictionDataByStack,
    getPredictionDataByMultipleStacks}= require('../controllers/PredictionOfConsumption')
// Route to get all prediction data
router.get('/allPredictionData', getAllPredictionData);

// Route to get prediction data by userName
router.get('/predictionData/:userName', getPredictionDataByUserName);

// Route to get prediction data by userName and stackName
router.get('/predictionData/:userName/:stackName', getPredictionDataByUserNameAndStackName);

// Route to get prediction data by userName, stackName, and predictionType
router.get('/predictionData/:userName/:stackName/:predictionType', getPredictionDataByUserNameAndStackNameAndInterval);

// Define the route for fetching prediction data for a single stack
router.get('/predictionByStack', getPredictionDataByStack);

// Define the route for fetching prediction data for multiple stacks
router.get('/predictionByMultipleStacks', getPredictionDataByMultipleStacks);

module.exports = router;
