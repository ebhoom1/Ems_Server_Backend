const express = require('express');
const router = express.Router();
const liveStationController = require('../controllers/liveStationController');

// Route to create a new live station
router.post(
  '/build-live-station',
  liveStationController.uploadImage, // Middleware to handle image upload
  liveStationController.createLiveStation // Controller function to create live station
);

// Route to get live station by userName
router.get(
  '/find-live-station/:userName',
  liveStationController.getLiveStationByUserName // Controller function to get live station
);

// Route to edit live station image by userName
router.patch(
  '/edit-live-station/:userName',
  liveStationController.uploadImage, // Middleware to handle image upload
  liveStationController.editLiveStationImage // Controller function to update live station image
);

// Route to delete a live station by userName
router.delete('/delete-live-station/:userName', liveStationController.deleteLiveStationByUserName);

router.delete('/liveStation/images/deleteAll',liveStationController.deleteAllImages);

module.exports = router;
