const express = require('express');
const router = express.Router();
const liveStationController = require('../controllers/liveStationController');

// Route to create a new live station
router.post(
  '/build-live-station',
  liveStationController.uploadImage, // Middleware to handle image upload
  liveStationController.createLiveStation // Controller function to create live station
);

// Route to get live station by userName and stationName
router.get(
  '/find-live-station/:userName/:stationName',
  liveStationController.getLiveStationByUserName // Controller function to get live station
);

// Route to edit live station by userName and stationName
router.patch(
  '/edit-live-station/:userName/:stationName',
  liveStationController.uploadImage, // Middleware to handle image upload
  liveStationController.editLiveStation // Controller function to update live station
);

// Route to delete a live station by userName and stationName
router.delete(
  '/delete-live-station/:userName/:stationName',
  liveStationController.deleteLiveStationByUserName
);

router.delete(
  '/liveStation/images/deleteAll',
  liveStationController.deleteAllImages
);
router.get(
  '/live-stations/:userName',
  liveStationController.getLiveStationsByUserName
);
module.exports = router;
