// const express = require('express');
// require('dotenv').config();
// const cors = require('cors');
// const bodyParser = require('body-parser');
// const cookieParser = require('cookie-parser');
// const path = require('path');
// const http = require('http');
// const socketIO = require('socket.io');
// const cron = require('node-cron');

// const DB = require('./config/DB');
// const Chat = require('./models/chatModel');
// const User = require('./models/user');
// const userdb = require("./models/user");

// // ---------------- ROUTES ----------------
// const assignmentRoutes = require("./routers/assignmentRoutes");
// const userRoutes = require('./routers/user');
// const calibrationRoutes = require('./routers/calibration');
// // const notificationRoutes = require('./routers/notification');
// const calibrationExceedRoutes = require('./routers/calibrationExceed');
// const calibrationExceedValuesRoute = require('./routers/calibrationExceedValues');
// const calculateAverageRoute = require('./routers/iotDataRouter');
// const reportRoutes = require('./routers/report');
// const paymentRoutes = require('./routers/payment');
// const liveVideoRoutes = require('./routers/liveVideo');
// const chatRoutes = require('./routers/chatRoutes');
// const dailyDifferencesRoutes = require('./routers/differenceData');
// const iotDataAveragesRoutes = require('./routers/iotDataAveragesRoute');
// const consumptionRoutes = require('./routers/consumptionRouter');
// const predictionRoutes = require('./routers/predictionRouter');
// const totalConsumptionSummaryRoutes = require('./routers/totalConsumptionSummaryRouter');
// const totalPredictionSummaryRoutes = require('./routers/totalPredictionSummaryRouter');
// const hourlyDataRoutes = require('./routers/hourlyData');
// const primaryStationRoutes = require('./routers/primaryStationRoutes');
// const billRoutes = require('./routers/billRoutes');
// const liveStationRoutes = require('./routers/liveStationRoutes');
// const logoRouter = require('./routers/logoRouter');
// const maxMinRoutes = require('./routers/maxMinRoutes');
// const avoidUsersRoutes = require('./routers/avoidUsers');
// const dailyConsumptionRoutes = require('./routers/dailyConsumptionRoutes');
// const wasteRoutes = require('./routers/wasteAndGeneratorRouter');
// const fuelRoutes = require('./routers/fuelRoutes');
// const generatorVehicleRoutes = require('./routers/generatorVehicleRoutes');
// const inventoryRoutes = require('./routers/inventory');
// const requestInventory = require('./routers/requestInventory');
// const equipmentRoutes = require('./routers/equipmentRoutes');
// const faultRoutes = require('./routers/faultRoutes');
// const techRoutes = require('./routers/technicianRoutes');
// const electricalReportRoutes = require('./routers/electricalReportRoutes');
// const mechRoutes = require('./routers/mechanicalReportRoutes');
// const dailyLogRoutes = require('./routers/dailyLogRoutes');
// const svgUploadRoutes = require('./routers/svgUpload');
// const attendanceRoutes = require('./routers/attendanceRoutes');
// const pumpStateRoutes = require('./routers/pumpStateRoutes');
// const pumpRuntimeRoutes = require('./routers/pumpRuntimeRoutes');
// const realtimeRoutes = require('./routers/realtime');
// const serviceReportRoutes = require('./routers/serviceReportRoutes');
// const engineerReportRoutes = require('./routers/engineerVisitReportRoutes');
// const safetyReportRoutes = require('./routers/safetyReportRoutes');
// const downloadRoutes = require('./routers/downloadRoutes');
// const consumptionRouters = require("./routers/consumptionRoutes");
// const reports3routes = require('./routers/reports3Routes');
// const realtimedatas3Route = require('./routers/realtimeDataRoutes');
// const reportSummaryRoutes = require("./routers/reportSummaryRoutes");
// const monthlyReportRoutes = require('./routers/monthlyReportRoutes');
// const monthlyMaintenanceReportRoutes = require('./routers/monthlyMaintenanceReportRoutes');
// const treatedWaterClarityRoutes = require("./routers/treatedWaterClarityRoutes");
// const equipmentStatusRoutes = require("./routers/equipmentStatusRoutes");
// const chemicalReportRoutes = require("./routers/chemicalReportRoutes");
// const mlssPhRouter = require("./routers/mlssPhRouter");
// const criticalSpareReportRoutes = require("./routers/criticalSpareReportRoutes");
// const ChemicalConsumptionReport = require("./routers/chemicalConsumptionRoutes");
// const powerConsumptionRoutes = require('./routers/powerConsumptionRoutes');
// const waterBalanceRoutes = require('./routers/waterBalanceRoutes');
// const plantOperatingRoutes = require("./routers/plantOperatingRoutes");
// const flowReportRoutes = require('./routers/flowReportRoutes');

// // ---------------- MQTT & SOCKET HELPERS ----------------
// const { initializeMqttClients } = require('./mqtt/mqtt-mosquitto');

// // ---------------- CRON / CONTROLLERS ----------------
// const { setupCronJobNotificationDelete } = require('./controllers/notification');
// const valveRoutes = require('./routers/valveRoutes');

// // const { setupCronJobNotificationDelete } = require('./controllers/notification');
// const { scheduleAveragesCalculation } = require('./controllers/iotDataAverages');
// const { schedulePredictionCalculation } = require('./controllers/predictionController');
// const { scheduleTotalConsumptionCalculation } = require('./controllers/consumptionController');
// const { setupCronJobTotalSummaryS3 } = require('./controllers/TotalConsumptionSummaryController');
// const { calculateTotalPredictionSummaryFromS3 } = require('./controllers/TotalPredictionSummaryController');
// const { scheduleExceedanceAveragesCalculation } = require('./controllers/averageExceedanceController');
// const { scheduleDailyDataSend } = require('./controllers/DataSend');
// const { setupCronJob } = require('./controllers/saveHourlyData');
// const { setupCronJobConsumption } = require('./controllers/consumption');
// const { setupCronJobPrediction } = require('./controllers/PredictionOfConsumption');
// const { scheduleDifferenceCalculation } = require('./controllers/differenceData');
// const { setupCronJobBillDelete } = require('./controllers/BillController');

// // ---------------- S3 BUCKET JOBS ----------------
// const { setupCronJobS3 } = require('./S3Bucket/s3IotData');
// const { setupCronJobS3Average } = require('./S3Bucket/s3AverageIotData');
// const { setupCronJobS3ParameterExceed } = require('./S3Bucket/s3ParameterExeceedance');
// const { setupCronJobS3ConsumptionData } = require('./S3Bucket/S3ConsumptionData');
// const { setupCronJobS3PredictionData } = require('./S3Bucket/s3PredictionDatas');
// const { setupCronJobS3TotalPredictionData } = require('./S3Bucket/s3TotalPredictionData');
// const { setupCronJobS3TotalConsumptionData } = require('./S3Bucket/s3TotalConsumptionData');
// const { setupCronJobS3HourlyData } = require('./S3Bucket/s3HourlyData');
// const { setupCronJobS3Report } = require('./S3Bucket/s3Report');
// const { setupCronJobS3Payment } = require('./S3Bucket/s3PaymentData');
// const { setupCronJobsForHourlyS3Upload } = require('./S3Bucket/s3differenceData');
// const { calculateAndSaveHourlyConsumption } = require('./S3Bucket/s3HourlyConsumption');

// // ---------------- REPORTS ----------------
// require('./schedulers/dailyReportScheduler');
// const { generateAndSendReport } = require('./controllers/DailyReport/reportGenerator');

// // ---------------- APP SETUP ----------------
// const app = express();
// const port = process.env.PORT || 5555;
// const server = http.createServer(app);

// // ---------------- CORS CONFIGURATION ----------------
// const allowedOrigins = [
//     'http://localhost:3000',
//     'http://localhost:3001',
//     'http://localhost:3002',
//     'http://localhost:5555',
//     'https://ems.ebhoom.com',
//     'https://api.ocems.ebhoom.com',
//     'https://esg.ebhoom.com',
//     'https://api.esg.ebhoom.com',
//     'https://ocems.ebhoom.com'
// ];

// app.use(cors({
//     origin: (origin, cb) => {
//         if (!origin) return cb(null, true);
//         if (allowedOrigins.includes(origin)) return cb(null, origin);
//         return cb(new Error('CORS blocked by policy'));
//     },
//     credentials: true,
//     methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
//     allowedHeaders: ['Content-Type', 'Authorization']
// }));

// // ---------------- MIDDLEWARE ----------------
// app.use(cookieParser());
// app.use(express.json({ limit: "10mb" })); // Increased limit for base64 if needed
// app.use(bodyParser.urlencoded({ extended: true }));
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// app.use(express.static(path.join(__dirname, '../Ems_client_frontend/build')));

// // Logging middleware
// app.use((req, res, next) => {
//     console.log(`${req.method} ${req.path}`);
//     next();
// });

// // ---------------- SOCKET.IO ----------------
// const io = socketIO(server, {
//     cors: {
//         origin: allowedOrigins,
//         methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
//     }
// });
// global.io = io; // Set global reference

// io.on('connection', (socket) => {
//     console.log('New client connected:', socket.id);

//     socket.on('joinRoom', ({ userId }) => {
//         socket.join(userId);
//         console.log(`User joined room: ${userId}`);
//     });

//     socket.on('sendStackData', (data) => {
//         const { userName, stackData } = data;
//         io.to(userName).emit('stackDataUpdate', {
//             stackData,
//             timestamp: new Date(),
//         });
//     });

//     socket.on('primaryStationUpdate', (data) => {
//         const { userName, primaryStation } = data;
//         if (userName && primaryStation) {
//             io.to(userName).emit('primaryStationUpdate', {
//                 data: primaryStation,
//                 timestamp: new Date(),
//             });
//         }
//     });

//     socket.on('chatMessage', async ({ from, to, message, files }) => {
//         try {
//             const chat = new Chat({ from, to, message, files });
//             await chat.save();
//             io.to(from).emit('newChatMessage', chat);
//             io.to(to).emit('newChatMessage', chat);
//         } catch (error) {
//             console.error('Chat error:', error);
//         }
//     });

//     socket.on('disconnect', () => console.log('Client disconnected'));
// });

// // Pass io to request object
// app.use((req, res, next) => {
//     req.io = io;
//     next();
// });

// // ---------------- API ROUTES ----------------
// app.use("/api", reportSummaryRoutes);
// app.use('/api', userRoutes);
// app.use('/api', calibrationRoutes);
// // app.use('/api', notificationRoutes);
// app.use('/api', calibrationExceedRoutes);
// app.use('/api', calibrationExceedValuesRoute);
// app.use('/api', calculateAverageRoute);
// app.use('/api', reportRoutes);
// app.use('/api', paymentRoutes);
// app.use('/api', liveVideoRoutes);
// app.use('/api', chatRoutes);
// app.use('/api', dailyDifferencesRoutes);
// app.use('/api', iotDataAveragesRoutes);
// app.use('/api', consumptionRoutes);
// app.use('/api', predictionRoutes);
// app.use('/api', totalConsumptionSummaryRoutes);
// app.use('/api', totalPredictionSummaryRoutes);
// app.use('/api', hourlyDataRoutes);
// app.use('/api', primaryStationRoutes);
// app.use('/api', billRoutes);
// app.use('/api', liveStationRoutes);
// app.use('/api', logoRouter);
// app.use('/api', maxMinRoutes);
// app.use('/api/fuel', fuelRoutes);
// app.use('/api', avoidUsersRoutes);
// app.use('/api', wasteRoutes);
// app.use('/api', dailyConsumptionRoutes);
// app.use('/api', generatorVehicleRoutes);
// app.use('/api', inventoryRoutes);
// app.use('/api', requestInventory);
// app.use('/api', equipmentRoutes);
// app.use('/api', faultRoutes);
// app.use('/api', techRoutes);
// app.use('/api', electricalReportRoutes);
// app.use('/api', mechRoutes);
// app.use('/api/dailyLog', dailyLogRoutes);
// app.use('/api', svgUploadRoutes);
// app.use('/api', attendanceRoutes);
// app.use('/api', pumpStateRoutes);
// app.use('/api', pumpRuntimeRoutes);
// app.use("/api", assignmentRoutes);
// app.use('/api', realtimeRoutes);
// app.use('/api', serviceReportRoutes);
// app.use('/api', engineerReportRoutes);
// app.use('/api', safetyReportRoutes);
// app.use('/api', downloadRoutes);
// app.use("/api", consumptionRouters);
// app.use('/api', reports3routes);
// app.use('/api', realtimedatas3Route);
// app.use('/api/monthly-report', monthlyReportRoutes);
// app.use('/api/monthly-maintenance', monthlyMaintenanceReportRoutes);
// app.use("/api/treated-water-clarity", treatedWaterClarityRoutes);
// app.use("/api/equipment-status", equipmentStatusRoutes);
// app.use('/api/chemical-report', chemicalReportRoutes);
// app.use('/api', mlssPhRouter);
// app.use("/api/critical-spares", criticalSpareReportRoutes);
// app.use("/api",ChemicalConsumptionReport);
// app.use("/api",powerConsumptionRoutes);
// app.use("/api",waterBalanceRoutes);
// app.use("/api/",plantOperatingRoutes);
// app.use("/api/",valveRoutes);


// app.use('/api/flow-report', flowReportRoutes); // <-- ADD THIS
// // WebSockets for real-time chat
// // WebSockets for real-time chat and energy data
// io.on('connection', (socket) => {
//     console.log('New client connected');

//     // Join room based on user ID
//     socket.on('joinRoom', ({ userId }) => {
//         socket.join(userId);
//         console.log(`User joined room: ${userId}`);
//     });
//        // Handle real-time stack data updates
//        socket.on('sendStackData', (data) => {
//         console.log('Stack data received:', data);
//         const { userName, stackData } = data;

//         // Emit stack data to the specific user room
//         io.to(userName).emit('stackDataUpdate', {
//             stackData, // Send the entire stack data array
//             timestamp: new Date(),
//         });
//         console.log(`Real-time stack data emitted to ${userName}`);
//     });
//        // Handle real-time consumption data updates
//        socket.on('consumptionDataUpdate', (data) => {
//         if (data.userName === userName && data.stacks) {
//             const updatedData = data.stacks.find(s => s.stackName === primaryStation);
//             if (updatedData) {
//                 setEnergyData({
//                     energyDailyConsumption: updatedData.energyDailyConsumption,
//                     energyMonthlyConsumption: updatedData.energyMonthlyConsumption,
//                     energyYearlyConsumption: updatedData.energyYearlyConsumption
//                 });
//             }
//         }
//     });     
//          // Handle real-time primary station updates
//     socket.on('primaryStationUpdate', (data) => {
//         const { userName, primaryStation } = data;
//         if (userName && primaryStation) {
//             io.to(userName).emit('primaryStationUpdate', {
//                 message: 'Primary station data updated',
//                 data: primaryStation,
//                 timestamp: new Date(),
//             });
//             console.log(`Real-time primary station update emitted to ${userName}`);
//         }
//     });

//     // Listen for chat messages
//     socket.on('chatMessage', async ({ from, to, message, files }) => {
//         try {
//             const chat = new Chat({ from, to, message, files });
//             await chat.save();
//             io.to(from).emit('newChatMessage', chat); // Emit to sender
//             io.to(to).emit('newChatMessage', chat);   // Emit to recipient
//         } catch (error) {
//             console.error('Error sending chat message:', error);
//         }
//     });

//     // Handle client disconnection
//     socket.on('disconnect', () => {
//         console.log('Client disconnected');
//     });
// });

// // Start the scheduling function when the server starts
// scheduleAveragesCalculation();

// // Start the scheduling function with logging
// console.log("Starting total consumption scheduling...");
// scheduleTotalConsumptionCalculation();

// // Start the scheduling
// schedulePredictionCalculation();

// //Start the TotalSummaryOfConsumption
// // setupCronJobTotalSummary();
// setupCronJobTotalSummaryS3();

// //Start the TotalPedictionSummaryCalculation
// // Start the TotalPredictionSummary Calculation
// //setupCronJobPredictionSummary();
// calculateTotalPredictionSummaryFromS3()
// //Start the Average of exceedence
// scheduleExceedanceAveragesCalculation();

// //Send data daily as CSV
// scheduleDailyDataSend()



// // Start the scheduling process
// console.log('scheduleDifferenceCalculation started');
// scheduleDifferenceCalculation();

// //Save hourly data of the energy and cumulatingFlow
// setupCronJob()


// // Save the conmpution data
// setupCronJobConsumption()

// //start the prediction 
// setupCronJobPrediction()

// // Schedule the task to delete old notifications every day at midnight
// // setupCronJobNotificationDelete()

// // Schedule the bill delete in every month 
// setupCronJobBillDelete()

// // Schedule the calculation of inflow, final flow, energy
// cron.schedule('59 23 * * *', async () => {
//     await calculateAndSaveDailyDifferences();
//     // console.log('Daily differences calculated and saved');
// });

// // Schedule the iotdata transfer to S3 bucket
// setupCronJobS3()

// // Schedule the averageIotData transfer to S3 bucket 
// setupCronJobS3Average()

// // Schedule the chatData transfer to S3 bucket
// //setupCronJobS3Chat()

// // Schedule the Paramter Exceed data transfer to S3 bucket
// setupCronJobS3ParameterExceed()

// //Schedule the consumptionData transfer to S3 bucket
// setupCronJobS3ConsumptionData();

// //Schedule the predictionData transfer to S3 bucket
// setupCronJobS3PredictionData();

// //Schedule the total ConsumptionData transfer to S3 bucket
// setupCronJobS3TotalConsumptionData();

// //Schedule the total PredictionData transfer to s3 bucket 
// setupCronJobS3TotalPredictionData();

// // Schedule the hourlyData of electricity data transfer to s3 bucket
// setupCronJobS3HourlyData()

// // Schedule the report Data transfer to s3 bucket
// setupCronJobS3Report();

// //Schedule the payment data transfer to s3 bucket
// setupCronJobS3Payment();


// //Schedule the difference data tranfer to S3 bucket in week
// setupCronJobsForHourlyS3Upload();

//     // Specific Cron Schedules
//     cron.schedule('33 1 * * *', async () => {
//         try {
//             const users = await User.find();
//             for (const user of users) await generateAndSendReport(user);
//         } catch (err) { console.error('Daily report error:', err); }
//     }, { timezone: 'Asia/Kolkata' });

//     cron.schedule('57 * * * *', calculateAndSaveHourlyConsumption, {
//         timezone: 'Asia/Kolkata'
//     });


// // ---------------- SERVER START ----------------
// server.listen(port, async () => {
//     console.log(`Server running on port ${port}`);
//     try {
//         await initializeMqttClients(io);
//         console.log('MQTT clients initialized successfully');
//     } catch (error) {
//         console.error('Failed to initialize MQTT clients:', error);
//     }
// });

// // ---------------- ERROR HANDLING ----------------
// app.use((err, req, res, next) => {
//     console.error(err.stack);
//     res.status(500).send('Internal Server Error');
// });

// // Catch-all for React
// app.get('*', (req, res) => {
//     res.sendFile(path.join(__dirname, '../Ems_client_frontend/build/index.html'));
// });

// module.exports = { io, server };


const express = require('express');
require('dotenv').config();
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');
const cron = require('node-cron');

const DB = require('./config/DB');
const Chat = require('./models/chatModel');
const User = require('./models/user');
const userdb = require("./models/user");

// ---------------- ROUTES ----------------
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
const dailyDifferencesRoutes = require('./routers/differenceData');
const iotDataAveragesRoutes = require('./routers/iotDataAveragesRoute');
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
const fuelRoutes = require('./routers/fuelRoutes');
const generatorVehicleRoutes = require('./routers/generatorVehicleRoutes');
const inventoryRoutes = require('./routers/inventory');
const requestInventory = require('./routers/requestInventory');
const equipmentRoutes = require('./routers/equipmentRoutes');
const faultRoutes = require('./routers/faultRoutes');
const techRoutes = require('./routers/technicianRoutes');
const electricalReportRoutes = require('./routers/electricalReportRoutes');
const mechRoutes = require('./routers/mechanicalReportRoutes');
const dailyLogRoutes = require('./routers/dailyLogRoutes');
const svgUploadRoutes = require('./routers/svgUpload');
const attendanceRoutes = require('./routers/attendanceRoutes');
const pumpStateRoutes = require('./routers/pumpStateRoutes');
const pumpRuntimeRoutes = require('./routers/pumpRuntimeRoutes');
const realtimeRoutes = require('./routers/realtime');
const serviceReportRoutes = require('./routers/serviceReportRoutes');
const engineerReportRoutes = require('./routers/engineerVisitReportRoutes');
const safetyReportRoutes = require('./routers/safetyReportRoutes');
const downloadRoutes = require('./routers/downloadRoutes');
const consumptionRouters = require("./routers/consumptionRoutes");
const reports3routes = require('./routers/reports3Routes');
const realtimedatas3Route = require('./routers/realtimeDataRoutes');
const reportSummaryRoutes = require("./routers/reportSummaryRoutes");
const monthlyReportRoutes = require('./routers/monthlyReportRoutes');
const monthlyMaintenanceReportRoutes = require('./routers/monthlyMaintenanceReportRoutes');
const treatedWaterClarityRoutes = require("./routers/treatedWaterClarityRoutes");
const equipmentStatusRoutes = require("./routers/equipmentStatusRoutes");
const chemicalReportRoutes = require("./routers/chemicalReportRoutes");
const mlssPhRouter = require("./routers/mlssPhRouter");
const criticalSpareReportRoutes = require("./routers/criticalSpareReportRoutes");
const ChemicalConsumptionReport = require("./routers/chemicalConsumptionRoutes");
const powerConsumptionRoutes = require('./routers/powerConsumptionRoutes');
const waterBalanceRoutes = require('./routers/waterBalanceRoutes');
const plantOperatingRoutes = require("./routers/plantOperatingRoutes");
const flowReportRoutes = require('./routers/flowReportRoutes');
const weeklyMaintenanceRoutes=require('./routers/weeklyMaintenanceRoutes');
const valveStateRoutes = require('./routers/valveRoutes');

// ---------------- MQTT & SOCKET HELPERS ----------------
const { initializeMqttClients } = require('./mqtt/mqtt-mosquitto');

// ---------------- CRON / CONTROLLERS ----------------
// const { setupCronJobNotificationDelete } = require('./controllers/notification');
const { scheduleAveragesCalculation } = require('./controllers/iotDataAverages');
const { schedulePredictionCalculation } = require('./controllers/predictionController');
const { scheduleTotalConsumptionCalculation } = require('./controllers/consumptionController');
const { setupCronJobTotalSummaryS3 } = require('./controllers/TotalConsumptionSummaryController');
const { calculateTotalPredictionSummaryFromS3 } = require('./controllers/TotalPredictionSummaryController');
const { scheduleExceedanceAveragesCalculation } = require('./controllers/averageExceedanceController');
const { scheduleDailyDataSend } = require('./controllers/DataSend');
const { setupCronJob } = require('./controllers/saveHourlyData');
const { setupCronJobConsumption } = require('./controllers/consumption');
const { setupCronJobPrediction } = require('./controllers/PredictionOfConsumption');
const { scheduleDifferenceCalculation } = require('./controllers/differenceData');
const { setupCronJobBillDelete } = require('./controllers/BillController');

// ---------------- S3 BUCKET JOBS ----------------
const { setupCronJobS3 } = require('./S3Bucket/s3IotData');
const { setupCronJobS3Average } = require('./S3Bucket/s3AverageIotData');
const { setupCronJobS3ParameterExceed } = require('./S3Bucket/s3ParameterExeceedance');
const { setupCronJobS3ConsumptionData } = require('./S3Bucket/S3ConsumptionData');
const { setupCronJobS3PredictionData } = require('./S3Bucket/s3PredictionDatas');
const { setupCronJobS3TotalPredictionData } = require('./S3Bucket/s3TotalPredictionData');
const { setupCronJobS3TotalConsumptionData } = require('./S3Bucket/s3TotalConsumptionData');
const { setupCronJobS3HourlyData } = require('./S3Bucket/s3HourlyData');
const { setupCronJobS3Report } = require('./S3Bucket/s3Report');
const { setupCronJobS3Payment } = require('./S3Bucket/s3PaymentData');
const { setupCronJobsForHourlyS3Upload } = require('./S3Bucket/s3differenceData');
const { calculateAndSaveHourlyConsumption } = require('./S3Bucket/s3HourlyConsumption');

// ---------------- REPORTS ----------------
require('./schedulers/dailyReportScheduler');
const { generateAndSendReport } = require('./controllers/DailyReport/reportGenerator');

// ---------------- APP SETUP ----------------
const app = express();
const port = process.env.PORT || 5555;
const server = http.createServer(app);

// ---------------- CORS CONFIGURATION ----------------
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:5555',
    'https://ems.ebhoom.com',
    'https://api.ocems.ebhoom.com',
    'https://esg.ebhoom.com',
    'https://api.esg.ebhoom.com',
    'https://ocems.ebhoom.com'
];

app.use(cors({
    origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (allowedOrigins.includes(origin)) return cb(null, origin);
        return cb(new Error('CORS blocked by policy'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// ---------------- MIDDLEWARE ----------------
app.use(cookieParser());
app.use(express.json({ limit: "10mb" })); // Increased limit for base64 if needed
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '../Ems_client_frontend/build')));

// Logging middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
});

// ---------------- SOCKET.IO ----------------
const io = socketIO(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
    }
});
global.io = io; // Set global reference

io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('joinRoom', ({ userId }) => {
        socket.join(userId);
        console.log(`User joined room: ${userId}`);
    });

    socket.on('sendStackData', (data) => {
        const { userName, stackData } = data;
        io.to(userName).emit('stackDataUpdate', {
            stackData,
            timestamp: new Date(),
        });
    });

    socket.on('primaryStationUpdate', (data) => {
        const { userName, primaryStation } = data;
        if (userName && primaryStation) {
            io.to(userName).emit('primaryStationUpdate', {
                data: primaryStation,
                timestamp: new Date(),
            });
        }
    });

    socket.on('chatMessage', async ({ from, to, message, files }) => {
        try {
            const chat = new Chat({ from, to, message, files });
            await chat.save();
            io.to(from).emit('newChatMessage', chat);
            io.to(to).emit('newChatMessage', chat);
        } catch (error) {
            console.error('Chat error:', error);
        }
    });

    socket.on('disconnect', () => console.log('Client disconnected'));
});

// Pass io to request object
app.use((req, res, next) => {
    req.io = io;
    next();
});

// ---------------- API ROUTES ----------------
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
app.use('/api', techRoutes);
app.use('/api', electricalReportRoutes);
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
app.use('/api', realtimedatas3Route);
app.use('/api/monthly-report', monthlyReportRoutes);
app.use('/api/monthly-maintenance', monthlyMaintenanceReportRoutes);
app.use("/api/treated-water-clarity", treatedWaterClarityRoutes);
app.use("/api/equipment-status", equipmentStatusRoutes);
app.use('/api/chemical-report', chemicalReportRoutes);
app.use('/api', mlssPhRouter);
app.use("/api/critical-spares", criticalSpareReportRoutes);
app.use("/api", ChemicalConsumptionReport);
app.use("/api", powerConsumptionRoutes);
app.use("/api", waterBalanceRoutes);
app.use("/api", plantOperatingRoutes);
app.use('/api/flow-report', flowReportRoutes);
app.use('/api/weekly-maintenance',weeklyMaintenanceRoutes);
app.use('/api', valveStateRoutes);

app.use((err, req, res, next) => {
  console.error("🔥 SERVER ERROR:", err);
  res.status(err.statusCode || 500).json({
    message: err.message || "Internal Server Error",
    code: err.code || null,
  });
});


// ---------------- TEST ENDPOINTS ----------------
app.get('/cors-test', (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.send('CORS is working!');
});

app.get("/api/test-push", async (req, res) => {
    const user = await userdb.findOne({ userName: "BBUSER" });
    if (!user?.pushSubscription) return res.status(400).send("No subscription found");
    // Note: ensure webpush is required if you use this endpoint
    res.send("Push test endpoint hit - requires webpush setup");
});

// ---------------- DATABASE & CRON INITIALIZATION ----------------
DB().then(() => {
    console.log("Database Connected. Initializing Schedulers...");
    scheduleAveragesCalculation();
    scheduleTotalConsumptionCalculation();
    schedulePredictionCalculation();
    setupCronJobTotalSummaryS3();
    calculateTotalPredictionSummaryFromS3();
    scheduleExceedanceAveragesCalculation();
    scheduleDailyDataSend();
    scheduleDifferenceCalculation();
    setupCronJob();
    setupCronJobConsumption();
    setupCronJobPrediction();
    // setupCronJobNotificationDelete();
    setupCronJobBillDelete();
    
    // S3 Schedulers
    setupCronJobS3();
    setupCronJobS3Average();
    setupCronJobS3ParameterExceed();
    setupCronJobS3ConsumptionData();
    setupCronJobS3PredictionData();
    setupCronJobS3TotalConsumptionData();
    setupCronJobS3TotalPredictionData();
    setupCronJobS3HourlyData();
    setupCronJobS3Report();
    setupCronJobS3Payment();
    setupCronJobsForHourlyS3Upload();

    // Specific Cron Schedules
    cron.schedule('33 1 * * *', async () => {
        try {
            const users = await User.find();
            for (const user of users) await generateAndSendReport(user);
        } catch (err) { console.error('Daily report error:', err); }
    }, { timezone: 'Asia/Kolkata' });

    cron.schedule('57 * * * *', calculateAndSaveHourlyConsumption, {
        timezone: 'Asia/Kolkata'
    });
});

// ---------------- SERVER START ----------------
server.listen(port, async () => {
    console.log(`Server running on port ${port}`);
    try {
        await initializeMqttClients(io);
        console.log('MQTT clients initialized successfully');
    } catch (error) {
        console.error('Failed to initialize MQTT clients:', error);
    }
});

// ---------------- ERROR HANDLING ----------------
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Internal Server Error');
});

// Catch-all for React
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../Ems_client_frontend/build/index.html'));
});

module.exports = { io, server };