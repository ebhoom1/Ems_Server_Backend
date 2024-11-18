const express = require('express');
const { 
    scheduleAveragesCalculation,
    findAverageDataUsingUserName,
    findAverageDataUsingUserNameAndStackName,
    findAverageDataUsingUserNameAndStackNameAndIntervalType,
    findAverageDataUsingUserNameAndStackNameAndIntervalTypeWithTimeRange,
    downloadAverageDataWithUserNameStackNameAndIntervalWithTimeRange,
    getAllAverageData
} = require('../controllers/iotDataAverages');

const router = express.Router();

// Route to schedule averages calculations
router.get('/schedule-averages', (req, res) => {
    scheduleAveragesCalculation();
    res.status(200).send('Scheduled averages calculations successfully!');
});

// Route to get all average data
router.get('/average/all', getAllAverageData);

// Route to get average data by userName
router.get('/average/user/:userName', findAverageDataUsingUserName);

// Route to get average data by userName and stackName
router.get('/average/user/:userName/stack/:stackName', findAverageDataUsingUserNameAndStackName);

// Route to get average data by userName, stackName, and intervalType
router.get(
    '/average/user/:userName/stack/:stackName/interval/:intervalType', 
    findAverageDataUsingUserNameAndStackNameAndIntervalType
);

// Route to get average data with time range filtering
router.get(
    '/average/user/:userName/stack/:stackName/interval/:intervalType/time-range', 
    findAverageDataUsingUserNameAndStackNameAndIntervalTypeWithTimeRange
);

// Route to download average data by userName, stackName, intervalType, and time range
router.get(
    '/average/download/user/:userName/stack/:stackName/interval/:intervalType/time-range', 
    downloadAverageDataWithUserNameStackNameAndIntervalWithTimeRange
);

module.exports = router;
