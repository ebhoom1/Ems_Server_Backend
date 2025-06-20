const mqtt = require("mqtt");
const axios = require("axios");
const moment = require("moment-timezone");
const userdb = require("../models/user");
const PumpState = require("../models/PumpState");
const pumpStateController = require("../controllers/pumpStateController");

const RETRY_DELAY = 5000; // 5 seconds

// MQTT Connection Options
const options = {
  host: "3.110.40.48",
  port: 1883,
  clientId: `EbhoomSubscriber-${Math.random().toString(16).substring(2, 10)}`,
  protocol: "mqtt",
  keepalive: 300,
  reconnectPeriod: RETRY_DELAY,
  clean: false,
  connectTimeout: 60000,
  pingTimeout: 120000,
};

let client;

// Track every command we send so we can drop its echo
const sentCommandIds = new Set();
const lastProcessedTime = {}; // For throttling sensor/tank data

function debugLog(...args) {
  console.log("🛠️ DEBUG:", ...args);
}

const setupMqttClient = (io) => {
  client = mqtt.connect(options);

  client.on("connect", () => {
    debugLog("Connected event fired");
    console.log("Connected to MQTT broker");

    client.subscribe("ebhoomPub", { qos: 1 }, (err) => {
      if (err) console.error("Subscription error (ebhoomPub):", err);
      else console.log("Subscribed to ebhoomPub (QoS 1)");
    });

    client.subscribe("ebhoomSub", { qos: 1 }, (err) => {
      if (err) console.error("Subscription error (ebhoomSub):", err);
      else console.log("Subscribed to ebhoomSub (QoS 1)");
    });
  });

  client.on("error", (err) => {
    console.error("MQTT connection error:", err);
  });

  client.on("offline", () => {
    console.log("MQTT client went offline");
  });

  client.on("reconnect", () => {
    console.log("Attempting to reconnect to MQTT broker");
  });

  client.on("message", async (topic, messageBuffer) => {
    try {
      const messageString = messageBuffer.toString();
      console.log(`\n--- Received on ${topic}:`, messageString);

      // Parse JSON into an array
      let data;
      try {
        data = JSON.parse(messageString);
        data = Array.isArray(data) ? data : [data];
      } catch (e) {
        console.log("Message not JSON, wrapping as plain string");
        data = [{ raw: messageString }]; // Use 'raw' to signify it's not a structured JSON
      }

      // --- ebhoomSub (Commands & Feedback) Handling ---
      if (topic === "ebhoomSub") {
        debugLog("Incoming messageIds for ebhoomSub:", data.map(d => d.messageId));
        debugLog("Current sentCommandIds:", Array.from(sentCommandIds));

        // === ECHO FILTER ===
        // Remove messages that are echoes of commands we sent
        data = data.filter(item => {
          if (item.messageId && sentCommandIds.has(item.messageId)) {
            debugLog("Dropping our own echo:", item.messageId);
            sentCommandIds.delete(item.messageId); // Remove from set after processing its echo
            return false;
          }
          return true;
        });

        debugLog("After echo-filter, messageIds for ebhoomSub:", data.map(d => d.messageId));
        if (data.length === 0) {
          debugLog("No items left after echo-filter on ebhoomSub; returning");
          return;
        }

        // Process remaining (genuine feedback) messages on ebhoomSub
        for (const feedback of data) {
          debugLog("Processing genuine ebhoomSub feedback item:", feedback);

          // Pump feedback (status updates from device)
          if (
            feedback.product_id &&
            feedback.userName &&
            Array.isArray(feedback.pumps)
          ) {
            console.log("Processing pump feedback:", feedback);
            const userDetails = await userdb.findOne({
              productID: feedback.product_id,
              userName: feedback.userName,
              pumpDetails: { $elemMatch: { pumpId: { $in: feedback.pumps.map(p => p.pumpId) } } }
            });

            if (!userDetails) {
              console.error("No user found in DB for pump feedback:", feedback.product_id, feedback.userName);
              continue;
            }

            const now = moment().tz("Asia/Kolkata").toDate();
            for (const { pumpId, pumpName, status } of feedback.pumps) {
              if (!pumpId || !pumpName || typeof status === "undefined") {
                console.error("Invalid pump entry in feedback:", { pumpId, pumpName, status });
                continue;
              }
              const payload = {
                product_id: feedback.product_id,
                userName: userDetails.userName,
                email: userDetails.email,
                mobileNumber: userDetails.mobileNumber,
                companyName: userDetails.companyName,
                industryType: userDetails.industryType,
                pumpData: { pumpId, pumpName, status },
                date: moment(now).format("DD/MM/YYYY"),
                time: moment(now).format("HH:mm"),
                timestamp: now,
              };
              console.log("Forwarding pump feedback payload:", payload);
              try {
                await axios.post("https://api.ocems.ebhoom.com/api/handleSaveMessage", payload);
                io.to(feedback.product_id.toString()).emit("pumpFeedback", payload);
              } catch (err) {
                console.error("Error saving pump feedback:", err.response?.data || err.message);
              }
            }
            continue; // Finished processing this feedback item
          }

          console.log("Unrecognized ebhoomSub feedback format:", feedback);
        }
        return; // Done with ebhoomSub topic
      }

      // --- ebhoomPub (Sensor/Tank Data & Pump Acknowledgments) Handling ---
      if (topic === "ebhoomPub") {
        for (const item of data) {
          debugLog("ebhoomPub item:", item);

          // Pump acknowledgments (device confirming receipt/action of a command)
          if (item.product_id && Array.isArray(item.pumps)) {
            console.log("Processing pump acknowledgment:", item);
            for (const pump of item.pumps) {
              try {
                await pumpStateController.updatePumpState(
                  item.product_id,
                  pump.pumpId,
                  pump.status === 1 || pump.status === "ON"
                );
              } catch (err) {
                console.error("Error saving pump state from acknowledgment:", err);
              }
            }
            const ackData = {
              product_id: item.product_id,
              pumps: item.pumps,
              message: item.message || "Pump status updated",
              timestamp: item.timestamp || new Date().toISOString(),
            };
            io.to(item.product_id.toString()).emit("pumpAck", ackData);
            io.to(item.product_id.toString()).emit("pumpStateUpdate", ackData);
            console.log("Pump acknowledgment forwarded:", ackData);
            continue; // Finished processing this acknowledgment
          }

          // Sensor & Tank data
          if (item.product_id && item.userName && Array.isArray(item.stacks)) {
            console.log("Processing sensor/tank data:", item);
            const now = moment().tz("Asia/Kolkata").toDate();
            const key = `${item.product_id}_${item.userName}`;

            // Throttling to prevent duplicate processing within a short time
            if (lastProcessedTime[key] && now - lastProcessedTime[key] < 1000) {
              console.log("Throttling duplicate sensor/tank message:", item);
              continue;
            }
            lastProcessedTime[key] = now;

            const userDetails = await userdb.findOne({
              productID: item.product_id,
              userName: item.userName,
              // Match any stack name from the incoming data with user's stored stack names
              stackName: { $elemMatch: { name: { $in: item.stacks.map(s => s.stackName) } } },
            });

            if (!userDetails) {
              console.error("No user found in DB for sensor/tank data:", item.product_id, item.userName);
              continue;
            }

            // Partition stacks into sensor and tank data based on `TankName` property
            const sensorStacks = item.stacks.filter(s => !s.TankName);
            const tankStacks = item.stacks.filter(s => !!s.TankName);

            // Process Sensor Data
            if (sensorStacks.length) {
              const sensorPayload = {
                product_id: item.product_id,
                userName: userDetails.userName,
                email: userDetails.email,
                mobileNumber: userDetails.mobileNumber,
                companyName: userDetails.companyName,
                industryType: userDetails.industryType,
                stacks: sensorStacks.map(s => ({
                  stackName: s.stackName,
                  ...Object.fromEntries(
                    // Filter out 'stackName' and 'N/A' values
                    Object.entries(s).filter(([k, v]) => k !== "stackName" && v !== "N/A")
                  )
                })),
                date: moment().format("DD/MM/YYYY"),
                time: moment().format("HH:mm"),
                timestamp: now,
              };
              console.log("Sending sensor payload:", sensorPayload);
              try {
                await axios.post("https://api.ocems.ebhoom.com/api/handleSaveMessage", sensorPayload);
                io.to(item.product_id.toString()).emit("data", sensorPayload); // Emit to room by product_id
              } catch (err) {
                console.error("Error sending sensor payload:", err.response?.data || err.message);
              }
            }

            // Process Tank Data
            if (tankStacks.length) {
              const tankPayload = {
                product_id: item.product_id,
                userName: userDetails.userName,
                email: userDetails.email,
                mobileNumber: userDetails.mobileNumber,
                companyName: userDetails.companyName,
                industryType: userDetails.industryType,
                // The 'stacks' field is required by the API, even if empty for tank data
                stacks: [{ stackName: "dummy", value: 0 }],
                tankData: tankStacks.map(t => ({
                  stackName: t.stackName,
                  //dwlrid: t.dwlrid,
                  tankName: t.TankName,
                 // depth: t.depth,
                  level: t.level, // Include level if available for tank data
                  percentage: t.percentage // Include percentage if available for tank data
                })),
                date: moment().format("DD/MM/YYYY"),
                time: moment().format("HH:mm"),
                timestamp: now,
              };
              console.log("Sending tank payload:", tankPayload);
              try {
                await axios.post("https://api.ocems.ebhoom.com/api/handleSaveMessage", tankPayload);
                io.to(item.product_id.toString()).emit("data", tankPayload); // Emit to room by product_id
                console.log("Tank data emitted");
              } catch (err) {
                console.error("Error sending tank payload:", err.response?.data || err.message);
              }
            }
            continue; // Finished processing this sensor/tank item
          }

          console.log("Unrecognized ebhoomPub format:", item);
        }
        return; // Done with ebhoomPub topic
      }
    } catch (err) {
      console.error("Error in MQTT message handler:", err);
    }
  });

  // --- Socket.IO Event Handlers ---
  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("joinRoom", (payload) => {
      // Allows joining with either a string product_id or an object { product_id: '...' }
      const product_id =
        typeof payload === "string" ? payload : payload && payload.product_id;

      if (!product_id) {
        console.error("Invalid joinRoom payload:", payload);
        return;
      }

      const room = product_id.toString();
      socket.join(room);
      console.log(`Socket ${socket.id} joined room ${room}`);
    });

    socket.on("controlPump", ({ product_id, pumps }) => {
      console.log(`Socket controlPump request received for product ${product_id}:`, pumps);

      if (!product_id || !Array.isArray(pumps) || pumps.length === 0) {
        console.error("Invalid pump control request from socket.");
        return;
      }
      sendPumpControlMessage(product_id, pumps);
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
    });
  });
};

const sendPumpControlMessage = (product_id, pumps) => {
  const messageId = `cmd-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`; // More robust unique ID
  const message = {
    product_id,
    pumps: pumps.map(p => ({
      pumpId: p.pumpId,
      pumpName: p.pumpName,
      status: p.status === "ON" ? 1 : 0, // Convert "ON"/"OFF" to 1/0
    })),
    timestamp: new Date().toISOString(),
    messageId, // Include unique ID for echo filtering
  };

  debugLog("sendPumpControlMessage → adding to sentCommandIds:", messageId);
  sentCommandIds.add(messageId); // Add command ID to set for echo filtering

  client.publish("ebhoomSub", JSON.stringify(message), { qos: 1 }, (err) => {
    if (err) console.error("Error publishing pump control:", err);
    else console.log("Pump command sent:", message);
  });
};

const initializeMqttClients = async (io) => {
  try {
    setupMqttClient(io);
    console.log("MQTT clients initialized.");
  } catch (err) {
    console.error("Error initializing MQTT clients:", err);
  }
};

module.exports = { setupMqttClient, initializeMqttClients };