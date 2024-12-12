const mqtt = require('mqtt');
const axios = require('axios');
const moment = require('moment-timezone'); // Use moment-timezone for accurate timezones
const userdb = require('../models/user'); // Import user schema

const RETRY_DELAY = 5000; // 5 seconds

// MQTT Connection Options
const options = {
    host: '3.110.40.48',
    port: 1883,
    clientId:`EbhoomSubscriber-${Math.random().toString(16).substring(2, 10)}`,
    protocol: 'mqtt',
    keepalive: 300,
    reconnectPeriod: RETRY_DELAY,
    clean: false,
    connectTimeout: 60000,
    pingTimeout: 120000,
};



const lastProcessedTime = {}; // Cache to store the last processed time for each user

const setupMqttClient = (io) => {
    const client = mqtt.connect(options);

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
    });

    // Handle Incoming Messages
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

            for (const item of data) {
                const { product_id, userName, stacks } = item;

                if (!product_id || !userName || !Array.isArray(stacks) || stacks.length === 0) {
                    console.error('Invalid data: Missing product_id, userName, or stack data.');
                    continue;
                }

                const currentTime = moment().tz('Asia/Kolkata').toDate();
                const timeKey = `${product_id}_${userName}`; // Create a unique key based on product_id and userName

                // Check if this user has a recorded last processed time
                if (lastProcessedTime[timeKey]) {
                    const lastTime = lastProcessedTime[timeKey];

                    // Check if the current message is too close in time to the last one processed
                    const timeDifference = currentTime - lastTime;
                    const timeThreshold = 1000; // 1000 ms = 1 second

                    if (timeDifference < timeThreshold) {
                        console.log('Ignoring duplicate message:', item);
                        continue; // Skip saving as it's considered a duplicate
                    }
                }

                // Update the last processed time for this user
                lastProcessedTime[timeKey] = currentTime;

                const userDetails = await userdb.findOne({
                    productID: product_id,
                    userName,
                    stackName: {
                        $elemMatch: { name: { $in: stacks.map(stack => stack.stackName) } }
                    },
                });

                if (!userDetails) {
                    console.error(`No matching user found for product_id: ${product_id}, userName: ${userName}`);
                    continue;
                }

                const payload = {
                    product_id,
                    userName: userDetails.userName,
                    email: userDetails.email,
                    mobileNumber: userDetails.mobileNumber,
                    companyName: userDetails.companyName,
                    industryType: userDetails.industryType,
                    stackData: stacks.map(stack => ({
                        stackName: stack.stackName,
                        ...Object.fromEntries(
                            Object.entries(stack).filter(([key, value]) => key !== 'stackName' && value !== 'N/A')
                        ),
                    })),
                    date: moment().format('DD/MM/YYYY'),
                    time: moment().format('HH:mm'),
                    timestamp: new Date(),
                };

                await axios.post('https://api.ocems.ebhoom.com/api/handleSaveMessage', payload); //https://api.ocems.ebhoom.com
                io.to(product_id.toString()).emit('data', payload);
                //console.log('Data successfully sent:', payload);
            }
        } catch (error) {
            console.error('Error handling MQTT message:', error);
        }
    });
}
// Initialize MQTT Clients at Server Startup
const initializeMqttClients = async (io) => {
    try {
        setupMqttClient(io);
        console.log('All MQTT clients initialized.');
    } catch (error) {
        console.error('Error initializing MQTT clients:', error);
    }
};

module.exports = { setupMqttClient, initializeMqttClients };