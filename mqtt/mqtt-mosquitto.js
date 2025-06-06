// mqttClient.js

const mqtt = require("mqtt");
const axios = require("axios");
const moment = require("moment-timezone");
const userdb = require("../models/user");          // adjust path if necessary
const IotData = require("../models/iotData");       // our updated IoT model
const pumpStateController = require("../controllers/pumpStateController");
const RETRY_DELAY = 5000; // 5 seconds

// MQTT connection options
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
const lastProcessedTime = {}; // { "<product_id>_<userName>": Date }

const setupMqttClient = (io) => {
  client = mqtt.connect(options);

  client.on("connect", () => {
    console.log("Connected to MQTT broker");

    // Subscribe to topics with QoS=1
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

  client.on("message", async (topic, message) => {
    try {
      const messageString = message.toString();
      console.log(`\nReceived message on ${topic}:`, messageString);

      let data;
      try {
        data = JSON.parse(messageString);
        data = Array.isArray(data) ? data : [data];
      } catch (_) {
        console.log("Message not JSON; treating as plain string.");
        data = [{ message: messageString }];
      }

      // -------- Handle ebhoomPub (sensor/tank & pump ACK) --------
      if (topic === "ebhoomPub") {
        for (const item of data) {
          // 1) Pump acknowledgment (device → backend)
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
            io.to(item.product_id.toString()).emit(
              "pumpStateUpdate",
              ackData
            );
            console.log("Pump acknowledgment forwarded:", ackData);
            continue;
          }

          // 2) Sensor / Tank data (device → backend)
          if (
            item.product_id &&
            item.userName &&
            Array.isArray(item.stacks) &&
            item.stacks.length > 0
          ) {
            const { product_id, userName, stacks } = item;
            const currentTime = moment().tz("Asia/Kolkata").toDate();
            const timeKey = `${product_id}_${userName}`;

            // Deduplication: ignore if same user sends < 1 second apart
            if (lastProcessedTime[timeKey]) {
              const lastTime = lastProcessedTime[timeKey];
              if (currentTime - lastTime < 1000) {
                console.log("Ignoring duplicate message:", item);
                continue;
              }
            }
            lastProcessedTime[timeKey] = currentTime;

            // Find user details by productID + userName
            const userDetails = await userdb.findOne({
              productID: product_id,
              userName,
            });
            if (!userDetails) {
              console.error(
                `No matching user for product_id: ${product_id}, userName: ${userName}`
              );
              continue;
            }

            // Split stacks into sensor vs. tank by “level”/“percentage” presence
            const sensorStacks = [];
            const tankStacks = [];
            for (const s of stacks) {
              if (
                Object.prototype.hasOwnProperty.call(s, "level") ||
                Object.prototype.hasOwnProperty.call(s, "percentage")
              ) {
                tankStacks.push(s);
              } else {
                sensorStacks.push(s);
              }
            }

            // --- Handle SENSOR data (ph, COD, BOD, etc.) ---
            if (sensorStacks.length > 0) {
              const sensorPayload = {
                product_id,
                userName: userDetails.userName,
                email: userDetails.email,
                mobileNumber: userDetails.mobileNumber,
                companyName: userDetails.companyName,
                industryType: userDetails.industryType,
                stacks: sensorStacks.map((stack) => ({
                  stackName: stack.stackName,
                  ...Object.fromEntries(
                    Object.entries(stack).filter(
                      ([k, v]) => k !== "stackName" && v !== "N/A"
                    )
                  ),
                })),
                date: moment(currentTime).format("DD/MM/YYYY"),
                time: moment(currentTime).format("HH:mm"),
                timestamp: new Date(),
              };

              console.log("Sending sensor payload:", sensorPayload);
              try {
                // Save sensor data to backend
                await axios.post(
                  "https://api.ocems.ebhoom.com/api/handleSaveMessage",
                  sensorPayload
                );
                // Emit to any client in the product_id room
                io.to(product_id.toString()).emit("data", sensorPayload);
              } catch (err) {
                console.error(
                  "Error sending sensor data:",
                  err.response ? err.response.data : err.message
                );
              }
            }

            // --- Handle TANK data (level & percentage) ---
            if (tankStacks.length > 0) {
              // Build stackData in the exact shape of StackSchema
              const stackDataArray = tankStacks.map((t) => ({
                stackName: t.stackName,        // required
                stationType: t.stationType,
                usdsid: t.usdsid,
                TankName: t.TankName,
                level: t.level,
                percentage: t.percentage,
              }));

              const tankPayload = {
                product_id,
                userName: userDetails.userName,
                email: userDetails.email,
                mobileNumber: userDetails.mobileNumber,
                companyName: userDetails.companyName,
                industryType: userDetails.industryType,
                stackData: stackDataArray,

                date: moment(currentTime).format("DD/MM/YYYY"),
                time: moment(currentTime).format("HH:mm"),
                timestamp: new Date(),
              };

              console.log("🚀 Sending tank payload:", tankPayload);
              try {
                // Save tank data to backend
                await axios.post(
                  "https://api.ocems.ebhoom.com/api/handleSaveMessage",
                  tankPayload
                );
                // Emit to room named by userName (so only interested clients see it)
                io.to(userDetails.userName).emit("data", tankPayload);
                console.log("✅ Tank data emitted successfully.");
              } catch (err) {
                console.error(
                  "❌ Error sending tank data:",
                  err.response ? err.response.data : err.message
                );
              }
            }

            continue;
          }

          console.log("Unrecognized ebhoomPub format:", item);
        }

        return; // done with ebhoomPub batch
      }

      // -------- Handle ebhoomSub (pump control & feedback) --------
      if (topic === "ebhoomSub") {
        for (const feedback of data) {
          // 1) Pump‐control feedback from device
          if (
            feedback.product_id &&
            feedback.userName &&
            Array.isArray(feedback.pumps)
          ) {
            const { product_id, userName, pumps } = feedback;
            console.log("Processing pump feedback:", feedback);

            const userDetails = await userdb.findOne({
              productID: product_id,
              userName,
              pumpDetails: {
                $elemMatch: { pumpId: { $in: pumps.map((p) => p.pumpId) } },
              },
            });
            if (!userDetails) {
              console.error(
                `No matching user for pump feedback (product_id: ${product_id}, userName: ${userName})`
              );
              continue;
            }

            const currentTime = moment().tz("Asia/Kolkata").toDate();
            for (const pump of pumps) {
              const { pumpId, pumpName, status } = pump;
              if (!pumpId || !pumpName || typeof status === "undefined") {
                console.error("Invalid pump feedback:", pump);
                continue;
              }

              const payload = {
                product_id,
                userName: userDetails.userName,
                email: userDetails.email,
                mobileNumber: userDetails.mobileNumber,
                companyName: userDetails.companyName,
                industryType: userDetails.industryType,
                pumpData: { pumpId, pumpName, status },
                date: moment(currentTime).format("DD/MM/YYYY"),
                time: moment(currentTime).format("HH:mm"),
                timestamp: currentTime,
              };

              try {
                await axios.post(
                  "https://api.ocems.ebhoom.com/api/handleSaveMessage",
                  payload
                );
                io.to(product_id.toString()).emit("pumpFeedback", payload);
                console.log("Pump feedback saved & emitted:", payload);
              } catch (err) {
                console.error(
                  "Error sending pump feedback data:",
                  err.response ? err.response.data : err.message
                );
              }
            }

            continue;
          }

          // 2) Pump‐control command from frontend → forward to device
          if (feedback.product_id && Array.isArray(feedback.pumps)) {
            console.log(
              "Pump control command received (forwarding):",
              feedback
            );
            sendPumpControlMessage(feedback.product_id, feedback.pumps);
            continue;
          }

          console.log("Unrecognized ebhoomSub format:", feedback);
        }

        return;
      }
    } catch (err) {
      console.error("Error handling MQTT message:", err);
    }
  });

  // -------- Socket.IO handlers --------
  io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);

    // Clients must join a “room” to receive tank updates
    socket.on("joinRoom", (payload) => {
      const product_id =
        typeof payload === "string" ? payload : payload && payload.product_id;
      if (!product_id) {
        console.error("Invalid joinRoom payload:", payload);
        return;
      }
      socket.join(product_id.toString());
      console.log(`Socket ${socket.id} joined room ${product_id}`);
    });

    // Frontend can request to control pumps:
    socket.on("controlPump", ({ product_id, pumps }) => {
      console.log(
        `Control Pump Request for product ${product_id}:`,
        pumps
      );
      if (!product_id || !Array.isArray(pumps) || pumps.length === 0) {
        console.error("Invalid pump control request");
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
    pumps: pumps.map((pump) => ({
      pumpId: pump.pumpId,
      pumpName: pump.pumpName,
      status: pump.status === "ON" ? 1 : 0,
    })),
    timestamp: new Date().toISOString(),
    messageId,
  };

  client.publish("ebhoomSub", JSON.stringify(message), { qos: 1 }, (err) => {
    if (err) {
      console.error("Error publishing pump control:", err);
    } else {
      console.log(`Pump command sent (ID: ${messageId}):`, message);
    }
  });
};

const initializeMqttClients = async (io) => {
  try {
    setupMqttClient(io);
    console.log("All MQTT clients initialized.");
  } catch (err) {
    console.error("Error initializing MQTT clients:", err);
  }
};

module.exports = { setupMqttClient, initializeMqttClients };
