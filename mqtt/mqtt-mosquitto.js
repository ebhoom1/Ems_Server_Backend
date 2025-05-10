
const mqtt = require('mqtt');
const axios = require('axios');
const moment = require('moment-timezone');
const userdb = require('../models/user');
const PumpState = require('../models/PumpState');
const pumpStateController = require('../controllers/pumpStateController');
const RETRY_DELAY = 5000; // 5 seconds

// MQTT Connection Options
const options = {
    host: '3.110.40.48',
    port: 1883,
    clientId: `EbhoomSubscriber-${Math.random().toString(16).substring(2, 10)}`,
    protocol: 'mqtt',
    keepalive: 300,
    reconnectPeriod: RETRY_DELAY,
    clean: false,
    connectTimeout: 60000,
    pingTimeout: 120000,
};

let client;
const lastProcessedTime = {};

const setupMqttClient = (io) => {
    client = mqtt.connect(options);

    // Connection event handlers
    client.on('connect', () => {
        console.log('Connected to MQTT broker');

        client.subscribe('ebhoomPub', { qos: 1 }, (err) => {
            if (err) {
                console.error('Subscription error (ebhoomPub):', err);
            } else {
                console.log('Subscribed to topic: ebhoomPub (QoS 1)');
            }
        });

        client.subscribe('ebhoomSub', { qos: 1 }, (err) => {
            if (err) {
                console.error('Subscription error (ebhoomSub):', err);
            } else {
                console.log('Subscribed to topic: ebhoomSub (QoS 1)');
            }
        });
    });

    client.on('error', (err) => {
        console.error('MQTT connection error:', err);
    });

    client.on('offline', () => {
        console.log('MQTT client went offline');
    });

    client.on('reconnect', () => {
        console.log('Attempting to reconnect to MQTT broker');
    });

    // Main message handler
    client.on('message', async (topic, message) => {
        try {
            const messageString = message.toString();
            console.log(`\nReceived message on ${topic}:`, messageString);

            let data;
            try {
                data = JSON.parse(messageString);
                data = Array.isArray(data) ? data : [data];
            } catch (parseError) {
                console.log('Message is not JSON, treating as plain string.');
                data = [{ message: messageString }];
            }

            // Handle ebhoomPub messages (acknowledgments and other data)
            if (topic === 'ebhoomPub') {
                for (const item of data) {
                    // PUMP ACKNOWLEDGMENT HANDLING
                    if (item.product_id && Array.isArray(item.pumps)) {
                        console.log('Processing pump acknowledgment:', item);
                        
                        // Update state in database for each pump
                        for (const pump of item.pumps) {
                            try {
                                await pumpStateController.updatePumpState(
                                    item.product_id,
                                    pump.pumpId,
                                    pump.status === 1 || pump.status === 'ON'
                                );
                            } catch (error) {
                                console.error('Error saving pump state:', error);
                            }
                        }
                      
                        // Format the acknowledgment for frontend
                        const ackData = {
                            product_id: item.product_id,
                            pumps: item.pumps,
                            message: item.message || 'Pump status updated',
                            timestamp: item.timestamp || new Date().toISOString()
                        };
                      
                        // Send to frontend via Socket.IO
                        io.to(item.product_id.toString()).emit('pumpAck', ackData);
                        // Also broadcast state update to all devices
                        io.to(item.product_id.toString()).emit('pumpStateUpdate', ackData);
                        
                        console.log('Pump acknowledgment forwarded:', ackData);
                        continue;
                    }
                    
                    // SENSOR AND TANK DATA HANDLING
                    if (item.product_id && item.userName && Array.isArray(item.stacks)) {
                        const { product_id, userName, stacks } = item;
            
                        if (!product_id || !userName || !Array.isArray(stacks) || stacks.length === 0) {
                            console.error('Invalid data: Missing product_id, userName, or stack data.');
                            continue;
                        }
            
                        const currentTime = moment().tz('Asia/Kolkata').toDate();
                        const timeKey = `${product_id}_${userName}`;
                        
                        // Deduplication check
                        if (lastProcessedTime[timeKey]) {
                            const lastTime = lastProcessedTime[timeKey];
                            const timeDifference = currentTime - lastTime;
                            const timeThreshold = 1000; // 1 second threshold
                            if (timeDifference < timeThreshold) {
                                console.log('Ignoring duplicate message:', item);
                                continue;
                            }
                        }
                        lastProcessedTime[timeKey] = currentTime;
            
                        const userDetails = await userdb.findOne({
                            productID: product_id,
                            userName,
                            stackName: {
                                $elemMatch: { name: { $in: stacks.map((stack) => stack.stackName) } },
                            },
                        });
                        
                        if (!userDetails) {
                            console.error(`No matching user found for product_id: ${product_id}, userName: ${userName}`);
                            continue;
                        }
            
                        // Partition stacks into sensor data and tank data
                        const sensorStacks = stacks.filter(stack => !stack.hasOwnProperty('TankName'));
                        const tankStacks = stacks.filter(stack => stack.hasOwnProperty('TankName'));
            
                        // Process sensor data
                        if (sensorStacks.length > 0) {
                            let sensorPayload = {
                                product_id,
                                userName: userDetails.userName,
                                email: userDetails.email,
                                mobileNumber: userDetails.mobileNumber,
                                companyName: userDetails.companyName,
                                industryType: userDetails.industryType,
                                stacks: sensorStacks.map((stack) => ({
                                    stackName: stack.stackName,
                                    ...Object.fromEntries(
                                        Object.entries(stack).filter(([key, value]) => key !== 'stackName' && value !== 'N/A')
                                    ),
                                })),
                                date: moment().format('DD/MM/YYYY'),
                                time: moment().format('HH:mm'),
                                timestamp: new Date(),
                            };
                            
                            console.log('Sending sensor payload:', sensorPayload);
                            try {
                                await axios.post('https://api.ocems.ebhoom.com/api/handleSaveMessage', sensorPayload);
                                io.to(product_id.toString()).emit('data', sensorPayload);
                                console.log('Sensor data successfully sent:', sensorPayload);
                            } catch (error) {
                                console.error('Error sending sensor data:', error.response ? error.response.data : error.message);
                            }
                        }
            
                        // Process tank data
                        if (tankStacks.length > 0) {
                            let tankPayload = {
                                product_id,
                                userName: userDetails.userName,
                                email: userDetails.email,
                                mobileNumber: userDetails.mobileNumber,
                                companyName: userDetails.companyName,
                                industryType: userDetails.industryType,
                                stacks: [], // include an empty array to satisfy the API requirement
                                tankData: tankStacks.map((tank) => ({
                                    stackName: tank.stackName,
                                    dwlrid: tank.dwlrid,
                                    tankName: tank.TankName,
                                    depth: tank.depth,
                                })),
                                date: moment().format('DD/MM/YYYY'),
                                time: moment().format('HH:mm'),
                                timestamp: new Date(),
                            };
                            
                            console.log('Sending tank payload:', tankPayload);
                            try {
                                await axios.post('https://api.ocems.ebhoom.com/api/handleSaveMessage', tankPayload);
                                io.to(product_id.toString()).emit('data', tankPayload);
                                console.log('Tank data successfully sent:', tankPayload);
                            } catch (error) {
                                console.error('Error sending tank data:', error.response ? error.response.data : error.message);
                            }
                        }
                        continue;
                    }
                    
                    console.log('Unrecognized message format on ebhoomPub:', item);
                }
                return;
            }

            // Handle ebhoomSub messages (pump commands and feedback)
            if (topic === 'ebhoomSub') {
                for (const feedback of data) {
                    // PUMP CONTROL FEEDBACK HANDLING
                    if (feedback.product_id && feedback.userName && Array.isArray(feedback.pumps)) {
                        const { product_id, userName, pumps } = feedback;

                        if (!product_id || !userName || !Array.isArray(pumps) || pumps.length === 0) {
                            console.error('Invalid pump feedback data: Missing product_id, userName, or pumps.');
                            continue;
                        }

                        const userDetails = await userdb.findOne({
                            productID: product_id,
                            userName,
                            pumpDetails: {
                                $elemMatch: { pumpId: { $in: pumps.map((pump) => pump.pumpId) } },
                            },
                        });

                        if (!userDetails) {
                            console.error(`No matching user found for product_id: ${product_id}, userName: ${userName}`);
                            continue;
                        }

                        const currentTime = moment().tz('Asia/Kolkata').toDate();

                        for (const pump of pumps) {
                            const { pumpId, pumpName, status } = pump;

                            if (!pumpId || !pumpName || typeof status === 'undefined') {
                                console.error('Invalid pump data:', pump);
                                continue;
                            }

                            const payload = {
                                product_id,
                                userName: userDetails.userName,
                                email: userDetails.email,
                                mobileNumber: userDetails.mobileNumber,
                                companyName: userDetails.companyName,
                                industryType: userDetails.industryType,
                                pumpData: {
                                    pumpId,
                                    pumpName,
                                    status,
                                },
                                date: moment(currentTime).format('DD/MM/YYYY'),
                                time: moment(currentTime).format('HH:mm'),
                                timestamp: currentTime,
                            };

                            try {
                                await axios.post('https://api.ocems.ebhoom.com/api/handleSaveMessage', payload);
                                io.to(product_id.toString()).emit('pumpFeedback', payload);
                                console.log('Pump feedback data successfully sent and saved:', payload);
                            } catch (error) {
                                console.error('Error sending pump feedback data:', error.response ? error.response.data : error.message);
                            }
                        }
                        continue;
                    }
                    
                    // PUMP CONTROL COMMAND HANDLING (from frontend)
                    if (feedback.product_id && Array.isArray(feedback.pumps)) {
                        console.log('Pump control command received:', feedback);
                        continue;
                    }
                    
                    console.log('Unrecognized message format on ebhoomSub:', feedback);
                }
                return;
            }

        } catch (error) {
            console.error('Error handling MQTT message:', error);
        }
    });

    // Socket.IO event handlers
    io.on('connection', (socket) => {
        console.log('New client connected');
        console.log('Socket connected');

        socket.on('joinRoom', (payload) => {
            // allow either socket.emit('joinRoom', '27') or socket.emit('joinRoom', { product_id: '27' })
            const product_id = typeof payload === 'string'
                ? payload
                : payload && payload.product_id;

            if (!product_id) {
                console.error('Invalid joinRoom payload:', payload);
                return;
            }

            const room = product_id.toString();
            socket.join(room);
            console.log(`Socket ${socket.id} joined room ${room}`);
        });

        socket.on('controlPump', ({ product_id, pumps }) => {
            console.log(`Control Pump Request Received for product ${product_id}:`, pumps);

            if (!product_id || !Array.isArray(pumps) || pumps.length === 0) {
                console.error('Invalid pump control request');
                return;
            }

            sendPumpControlMessage(product_id, pumps);
        });
    });
};

const sendPumpControlMessage = (product_id, pumps) => {
    const messageId = `cmd-${Date.now()}`;
    const message = {
        product_id,
        pumps: pumps.map(pump => ({
            pumpId: pump.pumpId,
            pumpName: pump.pumpName,
            status: pump.status === 'ON' ? 1 : 0
        })),
        timestamp: new Date().toISOString(),
        messageId // Add unique ID for tracking
    };

    client.publish('ebhoomSub', JSON.stringify(message), { qos: 1 }, (err) => {
        if (err) {
            console.error('Error publishing pump control:', err);
        } else {
            console.log(`Pump command sent (ID: ${messageId}):`, message);
        }
    });
};

const initializeMqttClients = async (io) => {
    try {
        setupMqttClient(io);
        console.log('All MQTT clients initialized.');
    } catch (error) {
        console.error('Error initializing MQTT clients:', error);
    }
};

module.exports = { setupMqttClient, initializeMqttClients };
