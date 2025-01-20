const express = require('express');
const {
     
    createWasteAndGenerator,
    updateWasteAndGenerator,
    deleteWasteAndGenerator,
    getWasteAndGeneratorByUserNameAndStationName,
    getWasteAndGeneratorByUserName,
    getAllWasteAndGenerator
} = require('../controllers/wasteAndGeneratorController');
const router = express.Router();

router.post('/waste', createWasteAndGenerator);
router.put('/waste/:id', updateWasteAndGenerator);
router.delete('/waste/:id', deleteWasteAndGenerator);
router.get('/waste/user/:userName', getWasteAndGeneratorByUserName);
router.get('/waste', getAllWasteAndGenerator);
// Route to get waste by userName and stationName
router.get('/waste/:userName/:stationName', getWasteAndGeneratorByUserNameAndStationName);

module.exports = router;