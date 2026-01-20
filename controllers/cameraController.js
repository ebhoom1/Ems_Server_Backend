const express = require('express');
const videoApp = express();
const { proxy } = require('rtsp-relay')(videoApp);

// Define all 4 Camera URLs in a map for easy access
const CAMERAS = {
    1: 'rtsp://admin:Mygenex2026Jeev@192.168.150.109:554/Streaming/Channels/102',
    2: 'rtsp://admin:Mygenex2026Jeev@192.168.150.109:554/Streaming/Channels/202',
    3: 'rtsp://admin:Mygenex2026Jeev@192.168.150.109:554/Streaming/Channels/302',
    4: 'rtsp://admin:Mygenex2026Jeev@192.168.150.109:554/Streaming/Channels/402'
};

// Create a dynamic WebSocket route that accepts an ID
// Example: ws://localhost:2000/api/stream/1
videoApp.ws('/api/stream/:id', (ws, req) => {
    const id = req.params.id;
    const cameraUrl = CAMERAS[id];

    if (!cameraUrl) {
        console.log(`❌ Invalid camera ID requested: ${id}`);
        ws.close();
        return;
    }

    console.log(`Frontend connected to Camera ${id}`);

    proxy({
        url: cameraUrl,
        verbose: false, // Set to true for debugging
        transport: 'tcp',
        additionalFlags: ['-q', '1'] // optimize quality/latency
    })(ws);
});

const PORT = 2000;
videoApp.listen(PORT, () => {
    console.log(`🎥 Video Stream Server running on port ${PORT}`);
});

module.exports = videoApp;
//added cameram