const express = require('express');
const { 
        getIotDataByUserName,
        getLatestIoTData,
        downloadIotData,
        handleSaveMessage,
        getDifferenceDataByUserName,
        getDifferenceDataByUserNameAndDateRange,
        downloadIotDataByUserName,
        deleteIotDataByDateAndUser,
        downloadIotDataByUserNameAndStackName,
        getIotDataByUserNameAndStackName,
        getIotDataByCompanyNameAndStackName,
        getIotDataByCompanyName,
        viewDataByDateUserAndStackName,
        getLast10MinIoTData,getRealTimeIoTData
        
} = require('../controllers/iotData');
const { getLatestDataByUserName } = require('../controllers/lastIotDataController');

const router = express.Router();

// Define the route for handleSaveMessage
router.post('/handleSaveMessage', handleSaveMessage);


// //Route to get the IOT values from DB
// router.get('/get-all-iot-values',getAllIotData);

//Route to find a IoT data using UserName
router.get('/get-IoT-Data-by-userName/:userName',getIotDataByUserName);

//Route to find a IoT data using Company Name
router.get('/get-IoT-Data-by-companyName/:companyName',getIotDataByCompanyName);

//Route for getting the latest IoT Data
router.get('/latest/:userName', getLatestDataByUserName);
  
//Route for getting 10 min data
router.get('/tenmin/:userName', getLast10MinIoTData);

// Add the route for fetching difference data by userName
router.get('/differenceData/:userName', getDifferenceDataByUserName);

// Route for fetching difference data by userName and date range
router.get('/differenceDataByDateRange', getDifferenceDataByUserNameAndDateRange);

//Route to download the Iot VAlue
router.get('/downloadIotData',downloadIotData);


router.get('/downloadIotDataByUserName',downloadIotDataByUserName)

router.get('/downloadIotDataByUserNameAndStackName',downloadIotDataByUserNameAndStackName)

// Route to view data by date and user
router.get('/view-data-by-date-user-stack', viewDataByDateUserAndStackName);

//Route to delete many by date
router.delete('/delete-by-date',deleteIotDataByDateAndUser)

router.get('/get-IoT-Data-by-userName-and-stackName/:userName/:stackName', getIotDataByUserNameAndStackName);
router.get('/get-IoT-Data-by-companyName-and-stackName/:companyName/:stackName',getIotDataByCompanyNameAndStackName);
router.get('/realtime/:userName', getRealTimeIoTData);

module.exports = router;

