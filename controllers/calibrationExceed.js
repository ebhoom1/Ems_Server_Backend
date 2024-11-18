const CalibrationExceed = require('../models/calibrationExceed');
const moment = require('moment');
const twilio = require('twilio');
const axios = require('axios');
const nodemailer = require('nodemailer');
const userdb = require('../models/user');
const { createNotification } = require('../controllers/notification');
const CalibrationExceedValues = require('../models/calibrationExceedValues');
const IotData = require('../models/iotData')
const Chat = require('../models/chatModel')
const User = require('../models/user');

// Create a new Twilio client
const accountsid ="AC16116151f40f27195ca7e326ada5cb83"
const authtoken = "d7ea43981a772f6b6c9bddb41a6a87ff"

const client = new twilio(accountsid, authtoken);

// // Function to send SMS notification for exceed calibration
// const sendSMS = async (to, message) => {
//     try {
//         // Send SMS
//         await client.messages.create({
//             body: message,
//             from: "+14423428965",
//             to: to
//         });
//         console.log(SMS sent successfully);
//     } catch (error) {
//         console.error(Error sending SMS:, error);

//         if (error.code === 20003) {
//             console.error(Authentication error: Check your Twilio credentials.);
//         } else {
//             console.error(Twilio error:, error.message);
//         }
//     }
// }
// Function to send SMS notification for exceed calibration using TextBelt API
// Function to send SMS notification using Fast2SMS API
const sendSMS = async (to, message) => {
    try {
        const response = await axios.post('https://www.fast2sms.com/dev/bulkV2', {
            route: 'q',
            message: message,
            language: 'english',
            flash: 0,
            numbers: to,
        }, {
            headers: {
                'authorization': '0J3goAnZwakj9eNfLK8IPz4yOXGlBvHtD5xisrdhVpbuc6WETCrUJGXQjTd7qF2Sv5nZmbgYWBhiyt0u',
                'Content-Type': 'application/json'
            }
        });
        if (response.data.return) {
            console.log(`SMS sent successfully: ${response.data}`);
        } else {
            console.error(`Error sending SMS: ${response.data.message}`);
        }
    } catch (error) {
        console.error(`Error sending SMS:`, error.response ? error.response.data : error.message);    }
};



// Email config
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    service: 'gmail',
    auth: {
        user: process.env.EMAIl,
        pass: process.env.PASSWORD
    }
})

// Function to send email
const sendEmail = async (to, subject, text) => {
    try {
        // Send mail with defined transport object
        await transporter.sendMail({
            from: process.env.EMAIl,
            to: to,
            subject: subject,
            text: text
        });
        console.log('Email sent successfully');
    } catch (error) {
        console.error('Error sending email:', error);    }
}

const addComment = async (req, res) => {
    try {
        const { id } = req.params;
       
        const updateFields = req.body;
      
        if (!updateFields.commentByUser) {
            updateFields.commentByUser = 'N/A';
        }
        if (!updateFields.commentByAdmin) {
            updateFields.commentByAdmin = 'N/A';
        }
    
        const calibrationExceedcomments = await CalibrationExceed.findByIdAndUpdate(
            id,
          { $set: updateFields },
          { new: true }
        );
    
        if (!calibrationExceedcomments) {
          return res.status(404).json({ message: 'Calibration Exceed comments not found' });
        }
    
        res.status(200).json({
          success: true,
          message: 'Comment added successfully',
          calibrationExceedcomments
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: 'Failed to add comment',
          error: error.message
        });
    }
}

const editComments = async (req, res) => {
    try {
        const { id } = req.params;
        const { commentByUser, commentByAdmin } = req.body;
        const updateFields = {};
        if (commentByUser) updateFields.commentByUser = commentByUser;
        if (commentByAdmin) updateFields.commentByAdmin = commentByAdmin;

        if (!updateFields.commentByUser) {
            updateFields.commentByUser = 'N/A';
        }
        if (!updateFields.commentByAdmin) {
            updateFields.commentByAdmin = 'N/A';
        }

        const updateComments = await CalibrationExceed.findByIdAndUpdate(
            id,
            { $set: updateFields },
            { new: true }
        );

        if (!updateComments) {
            return res.status(404).json({
                success: false,
                message: 'Comment not edited'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Comments updated successfully',
            comments: updateComments
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to update the comment',
            error: error.message
        });
    }
};

const getAllExceedData = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;  // Default to 10 records per page
        const skipIndex = (page - 1) * limit;

        const allComments = await CalibrationExceed.find()
            .sort({ timestamp: -1 })  // Ensuring the latest data is fetched first
            .limit(limit)
            .skip(skipIndex)
            .exec();

        res.status(200).json({
            success: true,
            message: 'All comments are found',
            data: allComments,
            page,
            limit
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch the comments',
            error: error.message
        });
    }
}


const getAUserExceedData = async (req, res) => {
    try {
        const { userName, industryType, companyName, fromDate, toDate, stackName } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;  // Default to 10 records per page
        const skipIndex = (page - 1) * limit;

        let query = {};

        if (userName) query.userName = decodeURIComponent(userName.trim());
        if (industryType) query.industryType = industryType;
        if (companyName) query.companyName = companyName;
        if (stackName) query.stackName = decodeURIComponent(stackName.trim());

        if (fromDate && toDate) {
            const parsedFromDate = moment(fromDate, 'DD-MM-YYYY').startOf('day').utc().toDate();
            const parsedToDate = moment(toDate, 'DD-MM-YYYY').endOf('day').utc().toDate();
            if (!parsedFromDate || !parsedToDate) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid date format. Use DD-MM-YYYY format.'
                });
            }
            query.timestamp = { $gte: parsedFromDate, $lte: parsedToDate };
        }

        const comments = await CalibrationExceed.find(query)
            .sort({ timestamp: -1 })
            .limit(limit)
            .skip(skipIndex)
            .exec();

        if (!comments || comments.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No comments found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Comments retrieved successfully',
            data: comments,
            page,
            limit
        });
    } catch (error) {
        console.error('Error retrieving data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve the comments',
            error: error.message
        });
    }
};




  
const getExceedDataByUserName = async(req, res) => {
    try {
        const { userName } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;  // Default to 10 records per page
        const skipIndex = (page - 1) * limit;

        // Retrieve Exceed Data using UserName with pagination
        const userExceedData = await CalibrationExceed.find({ userName: userName })
            .sort({ timestamp: -1 })  // Ensuring the latest data is fetched first
            .limit(limit)
            .skip(skipIndex)
            .exec();

        res.status(200).json({
            status: 200,
            success: true,
            message: `Calibration Exceed data of user ${userName} fetched successfully`,
            data: userExceedData,
            page,
            limit
        });

    } catch (error) {
        res.status(500).json({
            status: 500,
            success: false,
            message: "Error in fetching User Exceed Data",
            error: error.message,
        });
    }
};

  

/* try */
const handleExceedValues = async () => {
    try {
        // Fetch the latest IoT data entry
        const latestData = await IotData.findOne().sort({ timestamp: -1 });
        // console.log('latestData:', latestData);
        
        if (!latestData) {
            console.error('No IoT data found');
            return;
        }

        // Find the user based on the latestData's userName
        const user = await userdb.findOne({ userName: latestData.userName });
        // console.log('User:', user);

        if (!user) {
            console.error('User not found');
            return;
        }

        if (user.userType === 'user') {
            if (!user.industryType) {
                console.error(`User with ID ${user.userName} has no industry type specified.`);
                return;
            }
        }
        

            // Fetch the industry thresholds
            const industryThresholds = await CalibrationExceedValues.findOne({ industryType: user.industryType });
            // console.log('Industry Thresholds:', industryThresholds);

            if (!industryThresholds) {
                console.error(`No thresholds found for industry type: ${user.industryType}`);
                return;
            }
            

            const exceedances = [];

            // Iterate through each stack in stackData
            for (const stack of latestData.stackData) {
                console.log(`Checking stack: ${stack.stackName}`);

                // Define the parameters to be checked for this stack
                const exceedParameters = [
                    { parameter: 'ph', value: stack.ph, aboveThreshold: industryThresholds.phAbove, belowThreshold: industryThresholds.phBelow },
                    { parameter: 'turbidity', value: stack.turbidity, threshold: industryThresholds.turbidity },
                    { parameter: 'ORP', value: stack.ORP, threshold: industryThresholds.ORP },
                    { parameter: 'TDS', value: stack.TDS, threshold: industryThresholds.TDS },
                    { parameter: 'temperature', value: stack.temperature, threshold: industryThresholds.temperature },
                    { parameter: 'BOD', value: stack.BOD, threshold: industryThresholds.BOD },
                    { parameter: 'COD', value: stack.COD, threshold: industryThresholds.COD },
                    { parameter: 'TSS', value: stack.TSS, threshold: industryThresholds.TSS },
                    { parameter: 'PM', value: stack.PM, threshold: industryThresholds.PM },
                    { parameter: 'nitrate', value: stack.nitrate, threshold: industryThresholds.nitrate },
                    { parameter: 'ammonicalNitrogen', value: stack.ammonicalNitrogen, threshold: industryThresholds.ammonicalNitrogen },
                    { parameter: 'DO', value: stack.DO, threshold: industryThresholds.DO },
                    { parameter: 'chloride', value: stack.chloride, threshold: industryThresholds.chloride },
                    { parameter: 'SO2', value: stack.SO2, threshold: industryThresholds.SO2 },
                    { parameter: 'NO2', value: stack.NO2, threshold: industryThresholds.NO2 },
                    { parameter: 'Mercury', value: stack.Mercury, threshold: industryThresholds.Mercury },
                    { parameter: 'PM10', value: stack.PM10, threshold: industryThresholds.PM10 },
                    { parameter: 'PM25', value: stack.PM25, threshold: industryThresholds.PM25 },
                    { parameter: 'NOH', value: stack.NOH, threshold: industryThresholds.NOH },
                    { parameter: 'NH3', value: stack.NH3, threshold: industryThresholds.NH3 },
                    { parameter: 'WindSpeed', value: stack.WindSpeed, threshold: industryThresholds.WindSpeed },
                    { parameter: 'WindDir', value: stack.WindDir, threshold: industryThresholds.WindDir },
                    { parameter: 'AirTemperature', value: stack.AirTemperature, threshold: industryThresholds.AirTemperature },
                    { parameter: 'Humidity', value: stack.Humidity, threshold: industryThresholds.Humidity },
                    { parameter: 'solarRadiation', value: stack.solarRadiation, threshold: industryThresholds.solarRadiation },
                    { parameter: 'DB', value: stack.DB, threshold: industryThresholds.DB },
                    { parameter: 'inflow', value: stack.inflow, threshold: industryThresholds.inflow },
                    { parameter: 'finalflow', value: stack.finalflow, threshold: industryThresholds.finalflow },
                    { parameter: 'energy', value: stack.energy, threshold: industryThresholds.energy }
                ];

                // Check each parameter for exceedances
                for (const { parameter, value, aboveThreshold, belowThreshold, threshold } of exceedParameters) {
                    if (value === null || value === undefined) continue;

                    // Special case for 'ph' with above/below thresholds
                    if (parameter === 'ph' && 
                        ((aboveThreshold && value >= aboveThreshold) || (belowThreshold && value <= belowThreshold))) {
                        console.log(`Exceed detected for ${parameter}: ${value} in ${stack.stackName}`);
                        exceedances.push({ parameter, value, stackName: stack.stackName });
                    }
                    // General case for parameters with a single threshold
                    else if (threshold && value >= threshold) {
                        console.log(`Exceed detected for ${parameter}: ${value} in ${stack.stackName}`);
                        exceedances.push({ parameter, value, stackName: stack.stackName });
                    }
                    
                }
            }

            // Save exceedances and send notifications
         // Save exceedances and send notifications + chat messages
         // Fetch the admin user (or system user) for sending the chat message
         const adminUser = await User.findOne({ userName: 'Admin-Developer' });

         if (!adminUser) {
             console.error('Admin user not found.');
             return;
         }

         // Save exceedances and send notifications + chat messages
         for (const exceed of exceedances) {
             await saveExceedValue(exceed.parameter, exceed.value, user, exceed.stackName);
             //await sendNotification(exceed.parameter, exceed.value, user, exceed.stackName);

             // Send chat message about the exceedance
             const messageContent =` Exceedance detected for ${exceed.parameter} with value ${exceed.value} in ${exceed.stackName}.`;

             const chatMessage = new Chat({
                 from: adminUser._id, // Use admin user's ObjectId
                 to: user._id, // Use affected user's ObjectId
                 message: messageContent,
             });

             await chatMessage.save();
             console.log(`Chat message sent: ${messageContent}`);
         }
     } catch(err){
        console.log('Error handling exceed values',err);
        
     }

    /*  console.log('Exceed values handled successfully');

        console.log('Exceed values handled successfully'); */
   
};



   
const sendNotification = async (parameter, value, user,stackName) => {
    try {
        const message = `Your calibration for ${parameter} exceeds the threshold. The value is ${value} for company ${user.companyName} and userName ${user.userName} and station Name ${stackName}`;
        const currentDate = moment().format('DD/MM/YYYY');
        const currentTime = moment().format('HH:mm:ss');

        // Send SMS notification
        const today = moment().startOf('day');
        const lastExceedEntry = await CalibrationExceed.findOne({ userName: user.userName }).sort({ timestamp: -1 });

        if (!lastExceedEntry || moment(lastExceedEntry.timestamp).startOf('day').isBefore(today)) {
            if (user.mobileNumber) {
                await sendSMS(user.mobileNumber, message);
            }
        }

        // Send email notification
        if (user.email) {
            await sendEmail(user.email, 'Calibration Exceed Notification', message);
        }

        // Add notification to the database
         await createNotification(message, user._id, user.userName, currentDate, currentTime);
    } catch (error) {
        console.error('Error sending notification:', error);
    }
};
 
const saveExceedValue = async (parameter, value, user,stackName) => {
    try {
        console.log(`Saving exceed value for parameter: ${parameter}, value: ${value}, user:, user`);

        const currentDate = moment().format('DD/MM/YYYY');
        const currentTime = moment().format('HH:mm:ss');

        const lastEntry = await CalibrationExceed.findOne().sort({ sl_No: -1 });
        const newSerialNumber = lastEntry ? lastEntry.sl_No + 1 : 1;

        const newEntry = new CalibrationExceed({
            sl_No: newSerialNumber,
            parameter,
            value,
            timestamp: moment().toDate(),
            formattedDate: currentDate,
            formattedTime: currentTime,
            message:` Value Exceed in ${parameter} of ${value} for userId ${user.userName}`,
            userName: user.userName,
            stackName,
            industryType: user.industryType,
            companyName: user.companyName,
            commentByUser: 'N/A',
            commentByAdmin: 'N/A',
        });    

        await newEntry.save();
        console.log('Exceed value saved successfully');

        return {
            success: true,
            message: "Calibration Exceed value saved successfully",
            newEntry
        };
    } catch (error) {
        console.error('Error saving exceed value:', error);

        return {
            success: false,
            message: "Error saving data to MongoDB",
            error: error.message
        };
    }
};



module.exports = { addComment, getAllExceedData, editComments, getAUserExceedData, handleExceedValues,getExceedDataByUserName }