const mongoose = require('mongoose');
const Calibration = require('../models/calibration'); 
const Notification = require('../models/notification')

// Controller function to add a calibration
const addCalibration = async (req, res) => {
    try {
        const {
            adminID,
            adminName,
            dateOfCalibrationAdded,
            timeOfCalibrationAdded,
            date,
            userName,
            modelName,
            equipmentName,
            before,
            after,
            technician,
            notes
        } = req.body;

        // Create a new calibration object
        const newCalibration = new Calibration({
            adminID,
            adminName,
            dateOfCalibrationAdded,
            timeOfCalibrationAdded,
            date,
            userName,
            modelName,
            equipmentName,
            before,
            after,
            technician,
            notes
        });

        // Check if a Calibration with the same userName already exists
        const existingCalibration= await Calibration.findOne({userName})

        if(existingCalibration){
            return res.status(400).json({
                success:false,
                message:'Calibration with this userName already exists'
            })
        }

        // Save the new calibration to the database
        await newCalibration.save();

        res.status(201).json({
            success: true,
            message: 'Calibration added successfully',
            calibration: newCalibration
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to add calibration',
            error: error.message
        });
    }
};


// Controller function to view all calibrations
const viewAllCalibrations = async (req, res) => {
    try {
        // Retrieve all calibrations from the database
        const allCalibrations = await Calibration.find();

        res.status(200).json({
            success: true,
            message: 'Calibrations retrieved successfully',
            calibrations: allCalibrations
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve calibrations',
            error: error.message
        });
    }
};

// Controller function to find calibration by UserId
const findCalibrationByUserName = async (req, res) => {
    try {
        const{ userName}=req.params;

        const calibration=await Calibration.findOne({userName});

        if(!calibration){
            return res.status(404).json({status:404, message:"User Not Found"})
        }else{
            return res.status(200).json({
                success: true,
                message: 'found the calibration data using the Id',
                calibration: calibration
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to find calibration',
            error: error.message
        });
    }
   
    
};


// Controller function to edit a calibration
const editCalibration = async (req, res) => {
    try {
        const { userName } = req.params;
        const updateFields = req.body;

        // Find the calibration by ID and update it
        const updatedCalibration = await Calibration.findOneAndUpdate(    { userName: userName }, updateFields, { new: true });

        if (!updatedCalibration) {
            return res.status(404).json({
                success: false,
                message: 'Calibration not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Calibration updated successfully',
            calibration: updatedCalibration
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to update calibration',
            error: error.message
        });
    }
};
// Controller function to delete a calibration
const deleteCalibration = async (req, res) => {
    try {
        const { id } = req.params;

        // Find the calibration by ID and delete it
        const deletedCalibration = await Calibration.findByIdAndDelete(id);

        if (!deletedCalibration) {
            return res.status(404).json({
                success: false,
                message: 'Calibration not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Calibration deleted successfully',
            calibration: deletedCalibration
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to delete calibration',
            error: error.message
        });
    }
};

const checkAndSendNotification =async(req,res)=>{
    try {
        const tomorrow = new Date();
        
        tomorrow.setDate(tomorrow.getDate()+1);
        const tomorrowDateString = tomorrow.toISOString().split('T')[0];

        const calibrationDue = await Calibration.find({date:tomorrowDateString})

        calibrationDue.forEach(async (calibration)=>{
            const notificationMessage = `Calibration is scheduled for ${calibration.userName} on ${calibration.date}.`;
            const currentDate = new Date();
            const dateOfNotificationAdded = currentDate.toISOString().split('T')[0];
            const timeOfNotificationAdded = currentDate.toTimeString().split(' ')[0];
            //Creating notification for user
            const userNotification = new Notification({
                message: notificationMessage,
                userId: calibration.userId,
                userName: calibration.userName,
                dateOfNotificationAdded,
                timeOfNotificationAdded
            })
            await userNotification.save()

            // Create Notification for admin
            const adminNotification = new Notification({
                message: notificationMessage,
                adminID: calibration.adminID,
                adminName: calibration.adminName,
                dateOfNotificationAdded,
                timeOfNotificationAdded
            });
            await adminNotification.save();

            console.log(`Notification sent:`, notificationMessage)
        })
    } catch (error) {
        console.error(`Error in sending Notifications:`,error);
    }
};

//Schedule the function to run every day
setInterval(checkAndSendNotification, 24*60*60*1000);


module.exports = { addCalibration,viewAllCalibrations,findCalibrationByUserName,editCalibration,deleteCalibration,checkAndSendNotification};
