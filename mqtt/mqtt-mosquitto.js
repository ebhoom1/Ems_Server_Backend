const mqtt = require('mqtt');
const axios = require('axios');
const moment = require('moment-timezone'); // Ensure moment-timezone is properly imported
const userdb = require('../models/user'); // Import user schema

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

let client; // Declare client globally
const lastProcessedTime = {}; // Cache to store the last processed time for each user

const setupMqttClient = (io) => {
    client = mqtt.connect(options); // Initialize client here

    client.on('connect', () => {
        console.log('Connected to MQTT broker');

        // Subscribe to the topic only on a successful connection
        client.subscribe('ebhoomPub', (err) => {
            if (err) {
                console.error('Subscription error:', err);
            } else {
                console.log('Subscribed to topic: ebhoomPub');
            }
        });

        client.subscribe('ebhoomSub', (err) => {
            if (err) {
                console.error('Subscription error:', err);
            } else {
                console.log('Subscribed to topic: ebhoomSub for pump control feedback');
            }
        });
    });

    client.on('message', async (topic, message) => {
        try {
            const messageString = message.toString();

            let data;
            try {
                data = JSON.parse(messageString);
                data = Array.isArray(data) ? data : [data];
            } catch (parseError) {
                console.log('Invalid JSON. Treating message as plain string.');
                data = [{ message: messageString }];
            }

            if (topic === 'ebhoomSub') {
                for (const feedback of data) {
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



    const currentTime = moment().tz('Asia/Kolkata').toDate(); // Ensure correct time format



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



                }

                return; // Skip further processing for pump control feedback
            }
            for (const item of data) {
                const { product_id, userName, stacks } = item;
            
                if (!product_id || !userName || !Array.isArray(stacks) || stacks.length === 0) {
                    console.error('Invalid data: Missing product_id, userName, or stack data.');
                    continue;
                }
            
                const currentTime = moment().tz('Asia/Kolkata').toDate();
                const timeKey = `${product_id}_${userName}`;
                if (lastProcessedTime[timeKey]) {
                    const lastTime = lastProcessedTime[timeKey];
                    const timeDifference = currentTime - lastTime;
                    const timeThreshold = 1000; // 1 second threshold to filter duplicates
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
            
                // Partition stacks into sensor data and tank data.
                const sensorStacks = stacks.filter(stack => !stack.hasOwnProperty('TankName'));
                const tankStacks = stacks.filter(stack => stack.hasOwnProperty('TankName'));
            
                // If sensor data exists, build and send the sensor payload.
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
            
                // If tank data exists, build and send the tank payload.
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
                
            }
            
            
        } catch (error) {
            console.error('Error handling MQTT message:', error);
        }
    });

    io.on('connection', (socket) => {
        console.log('Socket connected');

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
    const topic = 'ebhoomSub';
    const formattedPumps = pumps.map((pump) => ({
        pumpId: pump.pumpId,
        pumpName: pump.pumpName,
        status: pump.status === 'ON' ? 1 : 0,
    }));

    const message = JSON.stringify({
        product_id,
        pumps: formattedPumps,
    });

    client.publish(topic, message, (err) => {
        if (err) {
            console.error('Error publishing pump control message:', err);
        } else {
            console.log(`Pump control message sent for product ${product_id}:`, message);
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