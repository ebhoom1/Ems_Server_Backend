const express = require('express')
const {
    addNotification,
    viewNotification,
    deleteNotification,
    getNotificationOfUser,
    
} = require('../controllers/notification')

const {checkAndSendNotification} = require('../controllers/calibration');

const router =express.Router()

//Add Notification
router.post('/add-notificaiton',addNotification);

//view All Notification
router.get('/view-notification',viewNotification);

//delete Notification
router.delete('/delete-notification/:id',deleteNotification);

// Get Notifications of a Specific User
router.get('/get-notification-of-user/:userName', getNotificationOfUser);


// Add a new route to manually trigger checkAndSendNotifications
router.get('/calibration-notification', async (req, res) => {
    try {
        await checkAndSendNotification();
        res.status(200).json({
            status:200,
            success: true,
            message: 'Notification check and send process completed successfully.',
            checkAndSendNotification
        });
    } catch (error) {
        res.status(500).json({
            status:500,
            success: false,
            message: 'Error in triggering notification check and send process.',
            error: error.message
        });
    }
});

module.exports =router;
