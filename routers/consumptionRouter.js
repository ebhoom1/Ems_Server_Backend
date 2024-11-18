const express = require('express');
const router = express.Router();
const {
    getConsumptionDataByUserNameAndStackName,
    getConsumptionDataByUserName,
    getAllConsumptionData,
    getConsumptionDataByUserNameAndStackNameAndInterval
} = require('../controllers/consumptionController');
const {getConsumptionData,getConsumptionDataByStacks,getConsumptionDataStackName,getLatestConsumptionData} = require('../controllers/consumption');

// Route to get data by userName and stackName
router.get('/consumptionData/:userName/:stackName', getConsumptionDataByUserNameAndStackName);

// Route to get data by userName and stackName and intervalType
router.get('/consumptionData/:userName/:stackName/:intervalType', getConsumptionDataByUserNameAndStackNameAndInterval);

// Route to get data by userName
router.get('/consumptionData/:userName', getConsumptionDataByUserName);

// Route to get all data
router.get('/allConsumptionData', getAllConsumptionData);

// Define the route for getting consumption data
router.get('/consumption-data', getConsumptionData);

router.get('/consumptionDataByStacks', getConsumptionDataByStacks);

router.get('/consumptionDataByStackName',getConsumptionDataStackName)

router.get ('/consumptionDataByUserName', getLatestConsumptionData);
module.exports = router;
