const express = require('express');
const router = express.Router();
const {
    getConsumptionDataByUserNameAndStackName,
    getConsumptionDataByUserName,
    getAllConsumptionData,
    getConsumptionDataByUserNameAndStackNameAndInterval,
    getConsumptionDataByUserNameAndDateRange,
    

    
} = require('../controllers/consumptionController');
const {getConsumptionData,getConsumptionDataByStacks,getConsumptionDataFromMongo,getConsumptionDataStackName,getLatestConsumptionData, getConsumptionDataByDateRange,getTodayConsumptionData} = require('../controllers/consumption');

// Route to get data by userName and stackName
router.get('/consumptionData/:userName/:stackName', getConsumptionDataByUserNameAndStackName);

// Route to get data by userName and stackName and intervalType
router.get('/consumptionData/:userName/:stackName/:intervalType', getConsumptionDataByUserNameAndStackNameAndInterval);

// Route to get data by userName
router.get('/consumptionData/:userName', getConsumptionDataByUserName);

// Route to get all data
router.get('/allConsumptionData', getAllConsumptionData);

// Define the route to fetch data by userName, intervalType, and date range
router.get("/consumption/:userName/:intervalType/date-range", getConsumptionDataByUserNameAndDateRange);


// Define the route for getting consumption data
router.get('/consumption-data', getConsumptionData);

router.get('/consumptionDataByStacks', getConsumptionDataByStacks);

router.get('/consumptionDataByStackName',getConsumptionDataStackName)

router.get ('/consumptionDataByUserName', getLatestConsumptionData);


// Route to get consumption data by userName and date range
router.get('/consumptionDataByDateRange', getConsumptionDataByDateRange);


router.get('/consumption-today',getTodayConsumptionData)

// Route to fetch consumption data by userName, stackName, date, and hour
router.get('/consumptionData', getConsumptionDataFromMongo);

module.exports = router;
