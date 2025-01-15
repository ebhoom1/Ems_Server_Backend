const express = require('express');
const {
    createWaste, updateWaste, deleteWaste,
    getWasteByUserName, getAllWaste,
    getWasteByUserNameAndStationName
} = require('../controllers/wasteController');
const router = express.Router();

router.post('/waste', createWaste);
router.put('/waste/:id', updateWaste);
router.delete('/waste/:id', deleteWaste);
router.get('/waste/user/:userName', getWasteByUserName);
router.get('/waste', getAllWaste);
// Route to get waste by userName and stationName
router.get('/waste/:userName/:stationName', getWasteByUserNameAndStationName);

module.exports = router;
