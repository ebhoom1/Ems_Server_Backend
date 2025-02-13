const express = require('express');
const { 
    scheduleAveragesCalculation,
    findAverageDataUsingUserName,
    findAverageDataUsingUserNameAndStackName,
    findAverageDataUsingUserNameAndStackNameAndIntervalType,
    findAverageDataUsingUserNameAndStackNameAndIntervalTypeWithTimeRange,
    downloadAverageDataWithUserNameStackNameAndIntervalWithTimeRange,
    getAllAverageData,
    fetchLastEntryOfEachDate,
    getTodayLastAverageDataByStackName,
    getHourlyDataForDailyInterval,
    getHourlyAveragesByDate
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

// Route to get average data with time range with last data of that date
router.get('/last-entry/user/:userName/stack/:stackName/interval/:intervalType', fetchLastEntryOfEachDate);

// Route to download average data by userName, stackName, intervalType, and time range
router.get(
    '/average/download/user/:userName/stack/:stackName/interval/:intervalType/time-range', 
    downloadAverageDataWithUserNameStackNameAndIntervalWithTimeRange
);

router.get('/averageData/today/:userName/:stackName/last',getTodayLastAverageDataByStackName);
// New route to get hourly data for a specific day based on userName and interval
router.get(
    '/average/user/:userName/interval/daily/hourly', 
    getHourlyDataForDailyInterval
);
router.get('/average/user/:userName/date/:day/:month/:year', getHourlyAveragesByDate);
module.exports = router;
