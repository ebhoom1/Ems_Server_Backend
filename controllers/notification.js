const mongoose = require('mongoose');
const Notification = require('../models/notification');
const cron = require('node-cron');

//Add Notification 
const addNotification = async (req,res) =>{
    try {
        const {
            message,
            adminID,
            adminName,             
            dateOfNoticationAdded,
            timeOfNoticationAdded,
            
        } =req.body

        //Create New Notification
        const newNotification = new Notification({message,
            adminID,
            adminName,
            dateOfNoticationAdded,
            timeOfNoticationAdded,
            })
        //Save the New Notification
        await newNotification.save()

        res.status(201).json({
            success:true,
            message:"New Notification is added",
            notification:newNotification
        })
    } catch (error) {
        res.status(500).json({
            success:false,
            message:"Error from Catch",
            error:error.message
        })
    }
}
//Add Notification for UserId
const createNotification = async (message,userId,userName,  currentDate,
    currentTime,req,res)=>{
    try{
        const newNotification = new Notification({
            subject:"Calibration Exceed",
            message,
            userId:userId,
            userName:userName,
            dateOfNoticationAdded:currentDate,
            timeOfNoticationAdded:currentTime
            
        });
        await newNotification.save();
        console.log('Notification Created:',newNotification);
        
    }catch(error){
        console.error("Error Creating notification:",error);
        res.status(500).json({
            status:500,
            success:false,
            message:"Error in creating Notification",
            errro:error.message
        })
    }
}
//View Notification
const viewNotification = async (req,res)=>{
    try {
        //Retrieve All Notification from database
        const allNotification = await Notification.find()

        res.status(200).json({
            success:true,
            message:"All Notification are successfully fetched",
            notification:allNotification
        })
    } catch (error) {
        res.status(500).json({
            success:false,
            message:"Error in Fetching all Notification",
            error:error.message
        })
    }
}

const getNotificationOfUser = async (req, res) => {
    try {
      const { userName } = req.params;
  
      // Retrieve notifications of the specific user from the database
      const userNotifications = await Notification.find({ userName });
  
      res.status(200).json({
        status: 200,
        success: true,
        message: `Notifications for user ${userName} fetched successfully`,
        userNotifications,
      });
    } catch (error) {
      res.status(500).json({
        status: 500,
        success: false,
        message: `Error in Fetching Notifications`,
        error: error.message,
      });
    }
  };

//Delete Notification

const deleteNotification = async(req,res)=>{
    try {
        const {id} = req.params;

        //find the Notification by Id and delete it
        const deletedNotification = await Notification.findByIdAndDelete(id)
        
        if(!deleteNotification){
            return res.status(404).json({
                success:false,
                meesage:"Notifications are not found"
            })
            
        }
        res.status(200).json({
            success:true,
            message:"Notification Deleted successfully",
            notification:deleteNotification
        })
    } catch (error) {
        res.status(500).json({
            success:false,
            message:'failed to delete Notification',
            error:error.message
        })
    }
}
const deleteOldNotifications = async () =>{
    try{
        const fourHundredDays = new Date();
        fourHundredDays.setDate(fourHundredDays.getDate()-400);

        const result =await Notification.deleteMany({dateOfNotificationAdded: { $lt: oneWeekAgo }})
        console.log(`Deleted ${result.deletedCount} old notifications`);
    }catch(error){
        console.error('Error deleting old notifications:', error);
    }
}
//Schedule the task to run every day at midnight
cron.schedule('0 0 * * *', () => {
    console.log('Running cron job to delete old notifications');
    deleteOldNotifications();
  });
module.exports ={addNotification,viewNotification,deleteNotification,getNotificationOfUser,createNotification,deleteOldNotifications};