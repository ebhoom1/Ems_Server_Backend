const express = require('express');
require('dotenv').config();
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path'); 
const DB = require('./config/DB');
const Chat = require('./models/chatModel'); // Import Chat model here
const userdb = require("./models/user");

const assignmentRoutes = require("./routers/assignmentRoutes");

const userRoutes = require('./routers/user');
const calibrationRoutes = require('./routers/calibration');
// const notificationRoutes = require('./routers/notification');
const calibrationExceedRoutes = require('./routers/calibrationExceed');
const calibrationExceedValuesRoute = require('./routers/calibrationExceedValues');
const calculateAverageRoute = require('./routers/iotDataRouter');
const reportRoutes = require('./routers/report');
const paymentRoutes = require('./routers/payment');
const liveVideoRoutes = require('./routers/liveVideo');
const chatRoutes = require('./routers/chatRoutes');
const dailyDifferencesRoutes = require('./routers/differenceData') 
const iotDataAveragesRoutes = require('./routers/iotDataAveragesRoute')
const consumptionRoutes = require('./routers/consumptionRouter');
const predictionRoutes = require('./routers/predictionRouter');
const totalConsumptionSummaryRoutes = require('./routers/totalConsumptionSummaryRouter');
const totalPredictionSummaryRoutes = require('./routers/totalPredictionSummaryRouter');
const hourlyDataRoutes = require('./routers/hourlyData');
const primaryStationRoutes = require('./routers/primaryStationRoutes');
const billRoutes = require('./routers/billRoutes');
const liveStationRoutes = require('./routers/liveStationRoutes');
const logoRouter = require('./routers/logoRouter');
const maxMinRoutes = require('./routers/maxMinRoutes');
const avoidUsersRoutes = require('./routers/avoidUsers');
const dailyConsumptionRoutes = require('./routers/dailyConsumptionRoutes');
const wasteRoutes = require('./routers/wasteAndGeneratorRouter');
const User = require('./models/user'); // Ensure you import the User model
const inventoryRoutes = require('./routers/inventory')
const requestInventory = require('./routers/requestInventory')
const equipmentRoutes =require('./routers/equipmentRoutes')
const electricalReportRoutes = require('./routers/electricalReportRoutes')
const mechRoutes = require('./routers/mechanicalReportRoutes');
const dailyLogRoutes = require('./routers/dailyLogRoutes');
const serviceReportRoutes = require('./routers/serviceReportRoutes')
const engineerReportRoutes=require('./routers/engineerVisitReportRoutes');
const safetyReportRoutes=require('./routers/safetyReportRoutes');
const reports3routes = require('./routers/reports3Routes')
const realtimedatas3Route = require('./routers/realtimeDataRoutes')
const flowReportRoutes = require('./routers/flowReportRoutes'); // <-- ADD THIS
const { getAllDeviceCredentials } = require('./controllers/user');
const {initializeMqttClients} = require('./mqtt/mqtt-mosquitto');
const http = require('http');
const socketIO = require('socket.io');
const fuelRoutes = require('./routers/fuelRoutes');
const generatorVehicleRoutes = require('./routers/generatorVehicleRoutes');
const faultRoutes = require('./routers/faultRoutes');
const techRoutes = require('./routers/technicianRoutes');
const pumpStateRoutes = require('./routers/pumpStateRoutes');
const pumpRuntimeRoutes=require('./routers/pumpRuntimeRoutes');
const realtimeRoutes = require('./routers/realtime');
const downloadRoutes = require('./routers/downloadRoutes');
const consumptionRouters = require("./routers/consumptionRoutes");
const reportSummaryRoutes = require("./routers/reportSummaryRoutes");
const monthlyReportRoutes = require('./routers/monthlyReportRoutes');
const monthlyMaintenanceReportRoutes = require('./routers/monthlyMaintenanceReportRoutes');
const treatedWaterClarityRoutes = require("./routers/treatedWaterClarityRoutes");
const equipmentStatusRoutes = require("./routers/equipmentStatusRoutes");
const chemicalReportRoutes = require("./routers/chemicalReportRoutes");
const mlssPhRouter = require("./routers/mlssPhRouter");
const criticalSpareReportRoutes = require("./routers/criticalSpareReportRoutes");
const ChemicalConsumptionReport=require("./routers/chemicalConsumptionRoutes");
const powerConsumptionRoutes = require('./routers/powerConsumptionRoutes');
const waterBalanceRoutes = require('./routers/waterBalanceRoutes');
const plantOperatingRoutes=require("./routers/plantOperatingRoutes")
const valveRoutes = require('./routers/valveRoutes');

const cron = require('node-cron');
// const { setupCronJobNotificationDelete } = require('./controllers/notification');
const { scheduleAveragesCalculation } = require('./controllers/iotDataAverages');
const {schedulePredictionCalculation} = require('./controllers/predictionController')
const {scheduleTotalConsumptionCalculation} = require('./controllers/consumptionController');
const {setupCronJobTotalSummary} =require('./controllers/TotalConsumptionSummaryController');
const {calculateTotalPredictionSummaryFromS3} = require('./controllers/TotalPredictionSummaryController');
// const totalPredictionSummaryController = require('./controllers/TotalPredictionSummaryController');
const {scheduleExceedanceAveragesCalculation} = require('./controllers/averageExceedanceController');
const {  scheduleDailyDataSend,sendDataDaily } = require('./controllers/DataSend');
const {setupCronJob} = require('./controllers/saveHourlyData');
const {setupCronJobConsumption}= require('./controllers/consumption');
const {setupCronJobPrediction} = require('./controllers/PredictionOfConsumption');
const {scheduleDifferenceCalculation } = require('./controllers/differenceData');
const {setupCronJobBillDelete} = require('./controllers/BillController');
const {setupCronJobTotalSummaryS3} = require('./controllers/TotalConsumptionSummaryController');

// S3 bucket data 
const {setupCronJobS3} = require('./S3Bucket/s3IotData')
const {setupCronJobS3Average} = require('./S3Bucket/s3AverageIotData')
const {setupCronJobS3Chat} = require('./S3Bucket/s3Chat');
const {setupCronJobS3ParameterExceed} = require('./S3Bucket/s3ParameterExeceedance');
const {setupCronJobS3ConsumptionData} = require('./S3Bucket/S3ConsumptionData');
const {setupCronJobS3PredictionData} = require('./S3Bucket/s3PredictionDatas');
const {setupCronJobS3TotalPredictionData} = require('./S3Bucket/s3TotalPredictionData');
const {setupCronJobS3TotalConsumptionData} = require('./S3Bucket/s3TotalConsumptionData');
const {setupCronJobS3HourlyData} = require('./S3Bucket/s3HourlyData');
const {setupCronJobS3Report} = require('./S3Bucket/s3Report');
const {setupCronJobS3Payment} = require('./S3Bucket/s3PaymentData');
const {setupCronJobsForHourlyS3Upload} = require('./S3Bucket/s3differenceData');
const { calculateAndSaveHourlyConsumption } = require('./S3Bucket/s3HourlyConsumption');
require('./schedulers/dailyReportScheduler')
const { generateAndSendReport } = require('./controllers/DailyReport/reportGenerator');
const svgUploadRoutes = require('./routers/svgUpload');
const attendanceRoutes = require('./routers/attendanceRoutes');


const app = express();
const port = process.env.PORT || 5555;
const server = http.createServer(app);

const io = socketIO(server, {
    cors: {
        origin: ['https://ocems.ebhoom.com','https://api.ocems.ebhoom.com','https://ems.ebhoom.com',
        'http://ems.ebhoom.com','http://localhost:5555','http://localhost:3000','http://localhost:3002','http://localhost:3001'], // Include other origins as needed
        methods: ["GET", "POST","PUT","PATCH","DELETE"],
    }
});
// Export io and server instances
module.exports = { io, server };

// Database connection
DB();

// Middleware
app.use(cors({
    origin: ['http://localhost:3000',  'http://localhost:3001','https://ems.ebhoom.com','https://api.ocems.ebhoom.com','http://localhost:3001','http://localhost:5555','https://esg.ebhoom.com','https://api.esg.ebhoom.com'  ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT','PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(cookieParser());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
// app.use(express.json({ limit: "10mb" })); // Needed for base64 image

// Serve static files from the React app's build directory
app.use(express.static(path.join(__dirname, '../Ems_client_frontend/build')));

// Serve static files from the 'uploads' folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Request logging middleware
app.use((req, res, next) => {
    console.log(req.path, req.method);
    next();
});

// Routes
app.use((req, res, next) => {
    req.io = io;
    next();
});
app.use("/api", reportSummaryRoutes);
app.use('/api', userRoutes);
app.use('/api', calibrationRoutes);
// app.use('/api', notificationRoutes);
app.use('/api', calibrationExceedRoutes);
app.use('/api', calibrationExceedValuesRoute);
app.use('/api', calculateAverageRoute);
app.use('/api', reportRoutes);
app.use('/api', paymentRoutes);
app.use('/api', liveVideoRoutes);
app.use('/api', chatRoutes);
app.use('/api', dailyDifferencesRoutes);
app.use('/api', iotDataAveragesRoutes);
app.use('/api', consumptionRoutes);
app.use('/api', predictionRoutes);  
app.use('/api', totalConsumptionSummaryRoutes);
app.use('/api', totalPredictionSummaryRoutes);
app.use('/api', hourlyDataRoutes);
app.use('/api', primaryStationRoutes);
app.use('/api', billRoutes);
app.use('/api', liveStationRoutes);
app.use('/api', logoRouter);
app.use('/api', maxMinRoutes);
app.use('/api/fuel', fuelRoutes);
app.use('/api', avoidUsersRoutes);
app.use('/api', wasteRoutes);
app.use('/api', dailyConsumptionRoutes);
app.use('/api', generatorVehicleRoutes);
app.use('/api', inventoryRoutes);
app.use('/api', requestInventory);
app.use('/api', equipmentRoutes);
app.use('/api', faultRoutes);
app.use('/api',electricalReportRoutes);
app.use('/api', techRoutes);
app.use('/api', mechRoutes);
app.use('/api/dailyLog', dailyLogRoutes);
app.use('/api', svgUploadRoutes);
app.use('/api', attendanceRoutes);
app.use('/api', pumpStateRoutes);
app.use('/api', pumpRuntimeRoutes);
app.use("/api", assignmentRoutes);
app.use('/api', realtimeRoutes);
app.use('/api', serviceReportRoutes);
app.use('/api', engineerReportRoutes);
app.use('/api', safetyReportRoutes);
app.use('/api', downloadRoutes);
app.use("/api", consumptionRouters);
app.use('/api', reports3routes);
app.use('/api',realtimedatas3Route);
app.use('/api/monthly-report', monthlyReportRoutes);
app.use('/api/monthly-maintenance', monthlyMaintenanceReportRoutes);
app.use("/api/treated-water-clarity", treatedWaterClarityRoutes);
app.use("/api/equipment-status", equipmentStatusRoutes);
app.use('/api/chemical-report', chemicalReportRoutes);
app.use('/api', mlssPhRouter); 
app.use("/api/critical-spares", criticalSpareReportRoutes);
app.use("/api",ChemicalConsumptionReport);
app.use("/api",powerConsumptionRoutes);
app.use("/api",waterBalanceRoutes);
app.use("/api/",plantOperatingRoutes);
app.use("/api/",valveRoutes);


app.use('/api/flow-report', flowReportRoutes); // <-- ADD THIS
// WebSockets for real-time chat
// WebSockets for real-time chat and energy data
io.on('connection', (socket) => {
    console.log('New client connected');

    // Join room based on user ID
    socket.on('joinRoom', ({ userId }) => {
        socket.join(userId);
        console.log(`User joined room: ${userId}`);
    });
       // Handle real-time stack data updates
       socket.on('sendStackData', (data) => {
        console.log('Stack data received:', data);
        const { userName, stackData } = data;

        // Emit stack data to the specific user room
        io.to(userName).emit('stackDataUpdate', {
            stackData, // Send the entire stack data array
            timestamp: new Date(),
        });
        console.log(`Real-time stack data emitted to ${userName}`);
    });
       // Handle real-time consumption data updates
       socket.on('consumptionDataUpdate', (data) => {
        if (data.userName === userName && data.stacks) {
            const updatedData = data.stacks.find(s => s.stackName === primaryStation);
            if (updatedData) {
                setEnergyData({
                    energyDailyConsumption: updatedData.energyDailyConsumption,
                    energyMonthlyConsumption: updatedData.energyMonthlyConsumption,
                    energyYearlyConsumption: updatedData.energyYearlyConsumption
                });
            }
        }
    });     
         // Handle real-time primary station updates
    socket.on('primaryStationUpdate', (data) => {
        const { userName, primaryStation } = data;
        if (userName && primaryStation) {
            io.to(userName).emit('primaryStationUpdate', {
                message: 'Primary station data updated',
                data: primaryStation,
                timestamp: new Date(),
            });
            console.log(`Real-time primary station update emitted to ${userName}`);
        }
    });

    // Listen for chat messages
    socket.on('chatMessage', async ({ from, to, message, files }) => {
        try {
            const chat = new Chat({ from, to, message, files });
            await chat.save();
            io.to(from).emit('newChatMessage', chat); // Emit to sender
            io.to(to).emit('newChatMessage', chat);   // Emit to recipient
        } catch (error) {
            console.error('Error sending chat message:', error);
        }
    });

    // Handle client disconnection
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Start the scheduling function when the server starts
scheduleAveragesCalculation();

// Start the scheduling function with logging
console.log("Starting total consumption scheduling...");
scheduleTotalConsumptionCalculation();

// Start the scheduling
schedulePredictionCalculation();

//Start the TotalSummaryOfConsumption
// setupCronJobTotalSummary();
setupCronJobTotalSummaryS3();

//Start the TotalPedictionSummaryCalculation
// Start the TotalPredictionSummary Calculation
//setupCronJobPredictionSummary();
calculateTotalPredictionSummaryFromS3()
//Start the Average of exceedence
scheduleExceedanceAveragesCalculation();

//Send data daily as CSV
scheduleDailyDataSend()



// Start the scheduling process
console.log('scheduleDifferenceCalculation started');
scheduleDifferenceCalculation();

//Save hourly data of the energy and cumulatingFlow
setupCronJob()


// Save the conmpution data
setupCronJobConsumption()

//start the prediction 
setupCronJobPrediction()

// Schedule the task to delete old notifications every day at midnight
// setupCronJobNotificationDelete()

// Schedule the bill delete in every month 
setupCronJobBillDelete()

// Schedule the calculation of inflow, final flow, energy
cron.schedule('59 23 * * *', async () => {
    await calculateAndSaveDailyDifferences();
    // console.log('Daily differences calculated and saved');
});

// Schedule the iotdata transfer to S3 bucket
setupCronJobS3()

// Schedule the averageIotData transfer to S3 bucket 
setupCronJobS3Average()

// Schedule the chatData transfer to S3 bucket
//setupCronJobS3Chat()

// Schedule the Paramter Exceed data transfer to S3 bucket
setupCronJobS3ParameterExceed()

//Schedule the consumptionData transfer to S3 bucket
setupCronJobS3ConsumptionData();

//Schedule the predictionData transfer to S3 bucket
setupCronJobS3PredictionData();

//Schedule the total ConsumptionData transfer to S3 bucket
setupCronJobS3TotalConsumptionData();

//Schedule the total PredictionData transfer to s3 bucket 
setupCronJobS3TotalPredictionData();

// Schedule the hourlyData of electricity data transfer to s3 bucket
setupCronJobS3HourlyData()

// Schedule the report Data transfer to s3 bucket
setupCronJobS3Report();

//Schedule the payment data transfer to s3 bucket
setupCronJobS3Payment();


//Schedule the difference data tranfer to S3 bucket in week
setupCronJobsForHourlyS3Upload();



// Scheduling the Daily Report to the user
// Scheduling the Daily Report to the user
console.log('Starting Daily Report Scheduling...');
cron.schedule('33 1 * * *', async () => {
    try {
        const users = await User.find(); // Fetch all users from the database
        for (const user of users) {
            await generateAndSendReport(user); // Pass each user to the function
        }
        console.log('Daily Report Scheduling Initialized.');
    } catch (error) {
        console.error('Error during daily report scheduling:', error);
    }
}, {
    timezone: 'Asia/Kolkata',
});
console.log('Daily Report Scheduling Initialized.');


// Schedule the hourly consumption calculation to run at 59 minutes past every hour
console.log("🕒 Scheduling hourly consumption job of real time ...");
cron.schedule('57 * * * *', calculateAndSaveHourlyConsumption, {
    timezone: 'Asia/Kolkata'
});
console.log("✅ Hourly consumption job scheduled to run at HH:57.");

// // Place this inside your app.js for testing
// app.get('/test-email', async (req, res) => {
//     try {
//         const users = await User.find({});
//         users.forEach(user => {
//             sendDataDaily(user); // Assuming sendDataDaily can handle being called directly like this
//         });
//         res.send('Email test initiated.');
//     } catch (error) {
//         console.error('Failed to send test emails:', error);
//         res.status(500).send('Failed to initiate email test.');
//     }
// });
// Initialize all MQTT clients at server startup
server.listen(port, async () => {
    console.log(`Server running on port ${port}`);
 // ✅ Set global socket reference
 global.io = io;
    // Initialize the MQTT client when the server starts
    try {
        await initializeMqttClients(io);
        console.log('MQTT clients initialized successfully');
    } catch (error) {
        console.error('Failed to initialize MQTT clients:', error);
    }
});
app.get('/cors-test', (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.send('CORS is working!');
});
app.get("/api/test-push", async (req, res) => {
  const user = await userdb.findOne({ userName: "BBUSER" });
  if (!user?.pushSubscription) return res.status(400).send("No subscription");

  const payload = JSON.stringify({
    title: "Test Push",
    body: "This is a test notification 🚀",
  });

  try {
    await webpush.sendNotification(user.pushSubscription, payload);
    res.send("Notification sent");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error sending notification");
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});


// Catch-all handler for any requests not handled above
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../Ems_client_frontend/build/index.html'));
});