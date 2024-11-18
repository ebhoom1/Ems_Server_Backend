// mqtt-to-rtdms.js

const axios = require('axios');
const mqtt = require('mqtt');
const moment = require('moment');
const fs = require('fs');

const RTDMS_API_URL = 'http://182.75.69.206:8080/v1.0/industry/<industryId>/station/<stationId>/data';
const RTDMS_AUTH_TOKEN = 'your_rtdms_token_here'; // Replace with actual token

// Define the paths to the certificates
const KEY = path.resolve(__dirname, './creds/ebhoom-v1-device-private.pem.key');
const CERT = path.resolve(__dirname, './creds/ebhoom-v1-device-certificate.pem.crt');
const CAfile = path.resolve(__dirname, './creds/ebhoom-v1-device-AmazonRootCA1.pem');

const mqttClient = mqtt.connect({
    host: "a3gtwu0ec0i4y6-ats.iot.ap-south-1.amazonaws.com",
    protocol: 'mqtts',
    keepalive: 30,
    clientId: "Ebhoom2023",
    clean: true,
    key: fs.readFileSync(KEY),
    cert: fs.readFileSync(CERT),
    ca: fs.readFileSync(CAfile),
});

mqttClient.on('connect', () => {
    console.log('Connected to MQTT broker for RTDMS');
    mqttClient.subscribe('ebhoomPub', (err) => {
        if (err) {
            console.error('Error subscribing to RTDMS topic:', err);
        }
    });
});

mqttClient.on('message', async (topic, message) => {
    try {
        const data = JSON.parse(message.toString());
        
        // Map the incoming data to the RTDMS API format
        const formattedData = {
            deviceId: data.deviceId || 'default-device-id',
            params: [
                {
                    parameter: 'pH',
                    value: data.ph,
                    unit: 'pH',
                    timestamp: moment().unix() * 1000, // Convert to Unix timestamp in milliseconds
                    flag: 'U'
                },
                {
                    parameter: 'bod',
                    value: data.BOD,
                    unit: 'mg/l',
                    timestamp: moment().unix() * 1000,
                    flag: 'U'
                },
                {
                    parameter: 'cod',
                    value: data.COD,
                    unit: 'mg/l',
                    timestamp: moment().unix() * 1000,
                    flag: 'U'
                },
                {
                    parameter: 'temperature',
                    value: data.temperature,
                    unit: '℃',
                    timestamp: moment().unix() * 1000,
                    flag: 'U'
                },
                {
                    parameter: 'tss',
                    value: data.TSS,
                    unit: 'mg/l',
                    timestamp: moment().unix() * 1000,
                    flag: 'U'
                },
            ],
            
        };

        // Send data to RTDMS API
        await sendToRTDMS(formattedData, '<industryId>', '<stationId>');
    } catch (error) {
        console.error('Error processing RTDMS MQTT message:', error);
    }
});

async function sendToRTDMS(data, industryId, stationId) {
    try {
        const response = await axios.post(
            `${RTDMS_API_URL.replace('<industryId>', industryId).replace('<stationId>', stationId)}`,
            [data],
            {
                headers: {
                    'Authorization': `Basic ${Buffer.from(RTDMS_AUTH_TOKEN).toString('base64')}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log('Data sent to RTDMS:', response.data);
    } catch (error) {
        console.error('Error sending data to RTDMS:', error);
    }
}

module.exports = { sendToRTDMS };
