
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    adminID:{
        type: String,
    },
    adminName:{
        type: String,
    },
    userId:{
        type:String,
    },
    userName:{
        type:String
    },

    dateOfNotificationAdded:{
        type: String,
    },
    timeOfNotificationAdded:{
        type: String,
    },
    subject:{
        type:String,
    },
    message:{
        type:String
    },
    
})
const Notification = mongoose.model('Notification',notificationSchema);

module.exports = Notification;