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
const lastProcessedTime = {};

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
        data = [{ raw: messageString }];
      }

      // DEBUG: show incoming messageIds
      if (topic === "ebhoomSub") {
        debugLog("Incoming messageIds:", data.map(d => d.messageId));
        debugLog("Current sentCommandIds:", Array.from(sentCommandIds));
      }

      // === ECHO FILTER ===
      if (topic === "ebhoomSub") {
        data = data.filter(item => {
          if (item.messageId && sentCommandIds.has(item.messageId)) {
            debugLog("Dropping our own echo:", item.messageId);
            sentCommandIds.delete(item.messageId);
            return false;
          }
          return true;
        });
        debugLog("After echo-filter, messageIds:", data.map(d => d.messageId));
        if (data.length === 0) {
          debugLog("No items left after echo-filter; returning");
          return;
        }

        // === GENUINE FEEDBACK FILTER ===
        data = data.filter(item =>
          typeof item.userName === "string" && Array.isArray(item.pumps)
        );
        debugLog("After feedback-filter, messageIds:", data.map(d => d.messageId));
        if (data.length === 0) {
          debugLog("No feedback items left; returning");
          return;
        }
      }

      // === ebhoomPub HANDLING ===
      if (topic === "ebhoomPub") {
        for (const item of data) {
          debugLog("ebhoomPub item:", item);
          // Pump acknowledgments
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
                console.error("Error saving pump state:", err);
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
            continue;
          }

          // Sensor & Tank data
          if (item.product_id && item.userName && Array.isArray(item.stacks)) {
            console.log("Processing sensor/tank data:", item);
            const now = moment().tz("Asia/Kolkata").toDate();
            const key = `${item.product_id}_${item.userName}`;
            if (lastProcessedTime[key] && now - lastProcessedTime[key] < 1000) {
              console.log("Throttling duplicate sensor/tank message:", item);
              continue;
            }
            lastProcessedTime[key] = now;

            const userDetails = await userdb.findOne({
              productID: item.product_id,
              userName: item.userName,
              stackName: { $elemMatch: { name: { $in: item.stacks.map(s => s.stackName) } } },
            });
            if (!userDetails) {
              console.error("No user for sensor/tank:", item.product_id, item.userName);
              continue;
            }

            // Partition...
            const sensorStacks = item.stacks.filter(s => !s.TankName);
            const tankStacks = item.stacks.filter(s => !!s.TankName);

            if (sensorStacks.length) {
              const payload = {
                product_id: item.product_id,
                userName: userDetails.userName,
                email: userDetails.email,
                mobileNumber: userDetails.mobileNumber,
                companyName: userDetails.companyName,
                industryType: userDetails.industryType,
                stacks: sensorStacks.map(s => ({
                  stackName: s.stackName,
                  ...Object.fromEntries(
                    Object.entries(s).filter(([k, v]) => k !== "stackName" && v !== "N/A")
                  )
                })),
                date: moment().format("DD/MM/YYYY"),
                time: moment().format("HH:mm"),
                timestamp: now,
              };
              console.log("Sending sensor payload:", payload);
              try {
                await axios.post("https://api.ocems.ebhoom.com/api/handleSaveMessage", payload);
                io.to(item.product_id.toString()).emit("data", payload);
              } catch (err) {
                console.error("Error sending sensor payload:", err.response?.data||err.message);
              }
            }

            if (tankStacks.length) {
              const payload = {
                product_id: item.product_id,
                userName: userDetails.userName,
                email: userDetails.email,
                mobileNumber: userDetails.mobileNumber,
                companyName: userDetails.companyName,
                industryType: userDetails.industryType,
                stacks: [{ stackName: "dummy", value: 0 }],
                tankData: tankStacks.map(t => ({
                  stackName: t.stackName,
                  dwlrid: t.dwlrid,
                  tankName: t.TankName,
                  depth: t.depth,
                })),
                date: moment().format("DD/MM/YYYY"),
                time: moment().format("HH:mm"),
                timestamp: now,
              };
              console.log("Sending tank payload:", payload);
              try {
                await axios.post("https://api.ocems.ebhoom.com/api/handleSaveMessage", payload);
                io.to(userDetails.userName).emit("data", payload);
                console.log("Tank data emitted");
              } catch (err) {
                console.error("Error sending tank payload:", err.response?.data||err.message);
              }
            }
            continue;
          }

          console.log("Unrecognized ebhoomPub format:", item);
        }
        return;
      }

      // === ebhoomSub HANDLING ===
      if (topic === "ebhoomSub") {
        for (const feedback of data) {
          debugLog("ebhoomSub feedback item:", feedback);

          // Pump feedback
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
              console.error("No user for pump feedback:", feedback.product_id, feedback.userName);
              continue;
            }

            const now = moment().tz("Asia/Kolkata").toDate();
            for (const { pumpId, pumpName, status } of feedback.pumps) {
              if (!pumpId || !pumpName || typeof status === "undefined") {
                console.error("Invalid pump entry:", { pumpId, pumpName, status });
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
                console.error("Error saving pump feedback:", err.response?.data||err.message);
              }
            }
            continue;
          }

          console.log("Unrecognized ebhoomSub format:", feedback);
        }
      }
    } catch (err) {
      console.error("Error in message handler:", err);
    }
  });

  // Socket.IO
  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("joinRoom", (room) => {
      console.log("Socket joinRoom:", room);
      socket.join(room);
    });

    socket.on("controlPump", ({ product_id, pumps }) => {
      console.log("Socket controlPump:", product_id, pumps);
      sendPumpControlMessage(product_id, pumps);
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
    });
  });
};

const sendPumpControlMessage = (product_id, pumps) => {
  const messageId = `cmd-${Date.now()}`;
  const message = {
    product_id,
    pumps: pumps.map(p => ({
      pumpId: p.pumpId,
      pumpName: p.pumpName,
      status: p.status === "ON" ? 1 : 0,
    })),
    timestamp: new Date().toISOString(),
    messageId,
  };
  debugLog("sendPumpControlMessage → adding to sentCommandIds:", messageId);
  sentCommandIds.add(messageId);

  client.publish("ebhoomSub", JSON.stringify(message), { qos: 1 }, (err) => {
    if (err) console.error("Error publishing pump control:", err);
    else console.log("Pump command sent:", message);
  });
};

const initializeMqttClients = async (io) => {
  try {
    setupMqttClient(io);
    console.log("MQTT clients initialized");
  } catch (err) {
    console.error("Error initializing MQTT clients:", err);
  }
};

module.exports = { setupMqttClient, initializeMqttClients };
