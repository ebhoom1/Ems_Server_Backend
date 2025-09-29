const mqtt = require("mqtt");
const axios = require("axios");
const moment = require("moment-timezone");
const userdb = require("../models/user");
const PumpState = require("../models/PumpState");
const pumpStateController = require("../controllers/pumpStateController");
const pumpDataController = require("../controllers/pumpDataController");
const {
  updateRuntimeFromRealtime,
} = require("../controllers/pumpRuntimeController");
const tankDataController = require("../controllers/tankDataController");
const RETRY_DELAY = 5000; // 5 seconds
const { saveRealtimeDataToS3 } = require("../S3Bucket/s3saveRealtimeData");
// --- 1. PUSH NOTIFICATION SETUP ---
const webpush = require("web-push");

// Use the VAPID keys from your .env file
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
};

// Configure web-push with your details
webpush.setVapidDetails(
  "mailto:your-email@example.com", // Replace with your admin email
  vapidKeys.publicKey,
  vapidKeys.privateKey
);
// --- END PUSH NOTIFICATION SETUP ---
// MQTT Connection Options
const options = {
  host: "3.108.105.76",
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

// === NEW: Store last tank data per productId ===
const lastTankDataByProductId = {};

function debugLog(...args) {
  console.log("🛠️ DEBUG:", ...args);
}

// ---- numeric coercion helpers ----
const toNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

// Clamp a number between min and max
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

// Convert a single tank stack entry to numeric fields
const coerceTankStack = (t) => ({
  stackName: t.stackName,
  tankName: t.TankName, // be consistent with your emitted field
  level: toNum(t.level, 0),
  percentage: clamp(toNum(t.percentage, 0), 0, 100),
});

// Convert a single sensor stack entry (keeps non-numeric fields as-is, numeric → number)
const coerceSensorStack = (s) => {
  const out = {
    stackName: s.stackName,
    stationType: s.stationType,
  };
  for (const [k, v] of Object.entries(s)) {
    if (k === "stackName" || k === "stationType") continue;
    const num = Number(v);
    out[k] = Number.isFinite(num) ? num : v; // keep strings like status, units, etc.
  }
  return out;
};

// --- 2. PUSH NOTIFICATION FUNCTION ---
async function triggerPushNotification(userName, fuelLevel) {
  // Check the low fuel condition
  if (fuelLevel !== undefined && fuelLevel <= 25) {
    try {
      // Find the user in the database to get their subscription object
      const user = await userdb.findOne({ userName: userName });

      // Check if the user and their subscription object exist
      if (user && user.pushSubscription) {
        const subscription = user.pushSubscription;
        const payload = JSON.stringify({
          title: "Low Fuel Alert",
          body: `Diesel is at ${fuelLevel}%. Please refill soon.`,
        });

        // Send the notification
        await webpush.sendNotification(subscription, payload);
        console.log(`Push notification sent successfully to ${userName}.`);
      }
    } catch (error) {
      console.error("Error sending push notification:", error.statusCode, error.body);
      // You can add logic here to remove expired subscriptions (e.g., if error.statusCode === 410)
    }
  }
}
// --- END PUSH NOTIFICATION FUNCTION ---
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
      // In mqtt.js
      // --- ebhoomSub (Commands & Feedback) Handling ---
      if (topic === "ebhoomSub") {
        try {
          const messageString = messageBuffer.toString();
          let data = JSON.parse(messageString);
          data = Array.isArray(data) ? data : [data];

          for (const item of data) {

            if (item.messageId && !item.userName) {
              debugLog(
                "Ignoring command echo or unrecognized command format:",
                item
              );
              continue; // Skip this item
            }

            // **Process genuine feedback from devices**
            // This logic assumes feedback messages contain a `userName`.
            if (item.product_id && item.userName && Array.isArray(item.pumps)) {
              console.log("Processing pump feedback:", item);
              // const productIdNumber = Number(item.product_id); 
              const userDetails = await userdb.findOne({
                productID: item.product_id,
                userName: item.userName,

              });

              if (!userDetails) {
                console.error(
                  "No user found in DB for pump feedback:",
                  item.product_id,
                  item.userName
                );
                continue;
              }

              const now = moment().tz("Asia/Kolkata").toDate();
              for (const { pumpId, pumpName, status } of item.pumps) {
                if (!pumpId || !pumpName || typeof status === "undefined") {
                  console.error("Invalid pump entry in feedback:", {
                    pumpId,
                    pumpName,
                    status,
                  });
                  continue;
                }
                const payload = {
                  product_id: item.product_id,
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
                  await pumpStateController.updatePumpState(
                    item.product_id,
                    pumpId,
                    status === 1 || status === "ON"
                  );
                  // await axios.post(
                  //   "https://api.ocems.ebhoom.com/api/handleSaveMessage",
                  //   payload
                  // );
                  io.to(item.product_id.toString()).emit(
                    "pumpFeedback",
                    payload
                  );
                } catch (err) {
                  console.error(
                    "Error saving pump feedback:",
                    err.response?.data || err.message
                  );
                }
              }
              continue; // Finished processing this feedback item
            }

            // If a message is neither an echo nor valid feedback
            console.log("Unrecognized ebhoomSub message format:", item);
          }
        } catch (err) {
          console.error(`Error processing message on topic ${topic}:`, err);
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

            //vibration
            //  await pumpDataController.savePumpMetrics(item);

            for (const pump of item.pumps) {
              try {
                await pumpStateController.updatePumpState(
                  item.product_id,
                  pump.pumpId,
                  pump.status === 1 || pump.status === "ON"
                );
                await updateRuntimeFromRealtime({
                  product_id: item.product_id,
                  userName: item.userName,
                  pumpId: pump.pumpId,
                  pumpName: pump.pumpName,
                  status:
                    pump.status === 1 || pump.status === "ON" ? "ON" : "OFF",
                  timestamp:
                    item.ntpTime || item.timestamp || new Date().toISOString(),
                });
              } catch (err) {
                console.error(
                  "Error saving pump state from acknowledgment:",
                  err
                );
              }
            }
            const ackData = {
              product_id: item.product_id,
              userName: item.userName,
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
          // if (item.product_id && item.userName && Array.isArray(item.stacks)) {
          //   console.log("Processing sensor/tank data:", item);
          //   const now = moment().tz("Asia/Kolkata").toDate();
          //   const key = `${item.product_id}_${item.userName}`;
          //   if (lastProcessedTime[key] && now - lastProcessedTime[key] < 1000) {
          //     console.log("Throttling duplicate sensor/tank message:", item);
          //     continue;
          //   }
          //   lastProcessedTime[key] = now;

          //   const userDetails = await userdb.findOne({
          //     productID: item.product_id,
          //     userName: item.userName,
          //     stackName: {
          //       $elemMatch: {
          //         name: { $in: item.stacks.map((s) => s.stackName) },
          //       },
          //     },
          //   });
          //   if (!userDetails) {
          //     console.error("No user found in DB for sensor/tank data:", item);
          //     continue;
          //   }

          //   // split into sensor vs. tank
          //   const sensorStacks = item.stacks.filter((s) => !s.TankName);
          //   const tankStacks = item.stacks.filter((s) => !!s.TankName);

          //   // —— Process Sensor Data ——
          //   if (sensorStacks.length) {
          //     // build a clean array of just the numeric fields
          //     const clean = sensorStacks.map((s) => ({
          //       stackName: s.stackName,
          //       stationType: s.stationType,
          //       ...Object.fromEntries(
          //         Object.entries(s).filter(
          //           ([k]) => k !== "stackName" && k !== "stationType"
          //         )
          //       ),
          //     }));

          //     const sensorPayload = {
          //       product_id: item.product_id,
          //       userName: userDetails.userName,
          //       email: userDetails.email,
          //       mobileNumber: userDetails.mobileNumber,
          //       companyName: userDetails.companyName,
          //       industryType: userDetails.industryType,
          //       stacks: clean,
          //       date: moment(now).format("DD/MM/YYYY"),
          //       time: moment(now).format("HH:mm"),
          //       timestamp: now,
          //     };

          //     console.log("Sending sensor payload:", sensorPayload);
          //     try {
          //       await axios.post(
          //         "https://api.ocems.ebhoom.com/api/handleSaveMessage",
          //         sensorPayload
          //       );
          //       // ← updated emit: join on userName, not product_id
          //       io.to(item.userName).emit("stackDataUpdate", {
          //         userName: item.userName,
          //         stackData: sensorPayload.stacks,
          //       });
          //     } catch (err) {
          //       console.error(
          //         "Error sending sensor payload:",
          //         err.response?.data || err.message
          //       );
          //     }
          //   }

          //   // —— Process Tank Data —— (unchanged)
          //   if (tankStacks.length) {
          //     const tankPayload = {
          //       product_id: item.product_id,
          //       userName: userDetails.userName,
          //       email: userDetails.email,
          //       mobileNumber: userDetails.mobileNumber,
          //       companyName: userDetails.companyName,
          //       industryType: userDetails.industryType,
          //       stacks: [{ stackName: "dummy", value: 0 }],
          //       tankData: tankStacks.map((t) => ({
          //         stackName: t.stackName,
          //         tankName: t.TankName,
          //         level: t.level,
          //         percentage: t.percentage,
          //       })),
          //       date: moment(now).format("DD/MM/YYYY"),
          //       time: moment(now).format("HH:mm"),
          //       timestamp: now,
          //     };
          //     console.log("Sending tank payload:", tankPayload);
          //     try {
          //       await axios.post(
          //         "https://api.ocems.ebhoom.com/api/handleSaveMessage",
          //         tankPayload
          //       );
          //       io.to(item.product_id.toString()).emit("data", tankPayload);
          //       // === NEW: Store last tank data for this productId ===
          //       lastTankDataByProductId[item.product_id.toString()] =
          //         tankPayload;
          //     } catch (err) {
          //       console.error(
          //         "Error sending tank payload:",
          //         err.response?.data || err.message
          //       );
          //     }
          //   }

          //   continue;
          // }
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

            // split into sensor vs. tank
            const sensorStacksRaw = item.stacks.filter((s) => !s.TankName);
            const tankStacksRaw = item.stacks.filter((s) => !!s.TankName);

            // --- Try strict user match first (with stackName elemMatch) ---
            let userDetails = await userdb.findOne({
              productID: item.product_id,
              userName: item.userName,
              stackName: {
                $elemMatch: {
                  name: { $in: item.stacks.map((s) => s.stackName) },
                },
              },
            });

            // --- If not found and we have only tank data, relax the condition ---
            if (!userDetails && tankStacksRaw.length && !sensorStacksRaw.length) {
              userDetails = await userdb.findOne({
                productID: item.product_id,
                userName: item.userName,
              });
              if (!userDetails) {
                console.error("No user found for tank-only data (relaxed lookup failed):", item);
                continue;
              } else {
                console.warn("Relaxed user lookup used for tank-only data:", {
                  productID: item.product_id,
                  userName: item.userName,
                });
              }
            }

            if (!userDetails) {
              console.error("No user found in DB for sensor/tank data:", item);
              continue;
            }

            // —— Process Sensor Data (coerced numbers) ——
            if (sensorStacksRaw.length) {
              const cleanSensor = sensorStacksRaw.map(coerceSensorStack);

              const sensorPayload = {
                product_id: item.product_id,
                userName: userDetails.userName,
                email: userDetails.email,
                mobileNumber: userDetails.mobileNumber,
                companyName: userDetails.companyName,
                industryType: userDetails.industryType,
                stacks: cleanSensor,
                date: moment(now).format("DD/MM/YYYY"),
                time: moment(now).format("HH:mm"),
                timestamp: now,
              };

              console.log("Sending sensor payload:", sensorPayload);
              try {
                await axios.post(
                  "https://api.ocems.ebhoom.com/api/handleSaveMessage",
                  sensorPayload
                );

                // 🔹 Save only energy data to S3
                await saveRealtimeDataToS3(sensorPayload);
                // Emit to userName room for sensors (as you already do)
                io.to(item.userName).emit("stackDataUpdate", {
                  userName: item.userName,
                  stackData: sensorPayload.stacks,
                });
                // --- 3. TRIGGER PUSH NOTIFICATION ---
                // Extract the fuel level from the clean sensor data
                const latestSensorData = cleanSensor[0];
                if (latestSensorData) {
                  const fuelLevel = latestSensorData.fuel_level_percentage;
                  // Call the function to check and send a notification if needed
                  await triggerPushNotification(item.userName, fuelLevel);
                }
                // --- END TRIGGER ---
              } catch (err) {
                console.error(
                  "Error sending sensor payload:",
                  err.response?.data || err.message
                );
              }
            }

            // —— Process Tank Data (coerced numbers) ——
            // In mqtt.js, find the section for processing tank data

            // —— Process Tank Data (coerced numbers) ——
            if (tankStacksRaw.length) {
              const tankData = tankStacksRaw.map(coerceTankStack);
              const tankPayload = {
                product_id: item.product_id,
                userName: userDetails.userName,
                email: userDetails.email,
                mobileNumber: userDetails.mobileNumber,
                companyName: userDetails.companyName,
                industryType: userDetails.industryType,
                stacks: [{ stackName: "dummy", value: 0 }],
                tankData, // <- numeric level/percentage
                date: moment(now).format("DD/MM/YYYY"),
                time: moment(now).format("HH:mm"),
                timestamp: now,
              };

              console.log("Sending tank payload:", tankPayload);

              try {
                // =========================================================
                // ▼▼▼ ADD THIS LINE TO SAVE THE DATA TO YOUR DATABASE ▼▼▼
                // =========================================================

                //tankdata
                //await tankDataController.saveTankData(tankPayload);

                // Your existing code to send data to the API and emit via socket
                await axios.post(
                  "https://api.ocems.ebhoom.com/api/handleSaveMessage",
                  tankPayload
                );

                const room = item.product_id.toString();
                io.to(room).emit("data", tankPayload);
                lastTankDataByProductId[room] = tankPayload;

              } catch (err) {
                console.error(
                  "Error sending/saving tank payload:", // Updated log message
                  err.response?.data || err.message
                );
              }
            }

            continue;
          }

          console.log("Unrecognized ebhoomPub format:", item);
        }
        return;
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

      // === NEW: Emit last tank data if available ===
      if (lastTankDataByProductId[room]) {
        socket.emit("data", lastTankDataByProductId[room]);
      }
    });

    socket.on("controlPump", ({ product_id, pumps }) => {
      console.log(
        `Socket controlPump request received for product ${product_id}:`,
        pumps
      );
      console.log(
        `[BACKEND] Received controlPump request from frontend for product ID: ${product_id}`
      );
      console.log("[BACKEND] Pumps data received:", pumps);

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

// const sendPumpControlMessage = (product_id, pumps) => {
//   const messageId = `cmd-${Date.now()}-${Math.random()
//     .toString(36)
//     .substring(2, 9)}`; // More robust unique ID
//   const message = {
//     product_id,
//     pumps: pumps.map((p) => ({
//       pumpId: p.pumpId,
//       pumpName: p.pumpName,
//       status: p.status === "ON" ? 1 : 0, // Convert "ON"/"OFF" to 1/0
//     })),
//     timestamp: new Date().toISOString(),
//     messageId, // Include unique ID for echo filtering
//   };

//   debugLog("sendPumpControlMessage → adding to sentCommandIds:", messageId);
//   sentCommandIds.add(messageId); // Add command ID to set for echo filtering

//   client.publish("ebhoomSub", JSON.stringify(message), { qos: 1 }, (err) => {
//     if (err) console.error("Error publishing pump control:", err);
//     else console.log("Pump command sent:", message);
//   });
// };

const sendPumpControlMessage = async (product_id, pumps) => {
  const messageId = `cmd-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const message = {
    product_id,
    pumps: pumps.map((p) => ({
      pumpId: p.pumpId,
      pumpName: p.pumpName,
      status: p.status === "ON" ? 1 : 0,
    })),
    timestamp: new Date().toISOString(),
    messageId,
  };

  try {
    // Set the pending status to true in the database for each pump
    for (const pump of pumps) {
      await pumpStateController.setPumpPending(product_id, pump.pumpId, true);
    }
  } catch (err) {
    console.error("Error setting pump pending status:", err);
  }

  // ... (rest of the sendPumpControlMessage function)
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
