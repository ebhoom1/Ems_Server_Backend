const mqtt = require("mqtt");
const axios = require("axios");
const moment = require("moment-timezone");
const crypto = require("crypto"); // Add this for MD5 computation (if not hardcoded)
const userdb = require("../models/user");
const PumpState = require("../models/PumpState");
const pumpStateController = require("../controllers/pumpStateController");
const valveStateController = require("../controllers/valveStateController");
const TankAlertState = require("../models/TankAlertState");

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
// const lastProcessedTime = {}; // For throttling sensor/tank data

// === NEW: Store last tank data per productId ===
const lastTankDataByProductId = {};

// ✅ DEDUPE sensor/tank payloads by content (NOT just time)
const lastSeenByKey = new Map(); // key -> { hash, ts }
const DEDUPE_MS_SENSOR = 1200; // drop same sensor payload within this window
const DEDUPE_MS_TANK = 1200;   // drop same tank payload within this window

function stableStringify(obj) {
  if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(",")}]`;
  if (obj && typeof obj === "object") {
    const keys = Object.keys(obj).sort();
    return `{${keys
      .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(obj);
}

function hashObj(obj) {
  return crypto.createHash("sha1").update(stableStringify(obj)).digest("hex");
}

/**
 * Returns true if we should DROP the payload as a duplicate.
 * Uses separate keys for sensor vs tank so they don't block each other.
 */
function shouldDropDuplicate({ productId, userName, kind, payload, windowMs }) {
  const k = `${productId}_${userName}_${kind}`;
  const h = hashObj(payload);
  const now = Date.now();

  const prev = lastSeenByKey.get(k);
  if (prev && prev.hash === h && (now - prev.ts) < windowMs) return true;

  lastSeenByKey.set(k, { hash: h, ts: now });
  return false;
}


// --- AADHAV API CONFIGURATION ---
// Hardcoded for India Land Tech Park Pvt Ltd - STP Outlet (managed by Goodfoot Sustainability)
const AADHAV_CONFIG = {
  baseUrl: "http://sityog.org/aadhav/dataApiAadhavSecure.php",
  apiKey: "GOOJDRE4VsdfsMyIz23", // From email
  industryId: 120,
  stationId: 249,
  // Pre-computed MD5 key (you can recompute if needed: md5(`${industryId}_${stationId}_${apiKey}`))
  md5Key: "b0623209daed3940427e82bf6a7c968c",
  // Target identifiers for this integration
  targetUserName: "INDL40",
  targetCompanyName: "India Land Tech Park",
  targetProductId: "40",
  targetStackName: "STP",
  targetStationType: "effluent",
  // New: Targets for flow data (STP outlet)
  targetFlowStackName: "STP outlet",
  targetFlowStationType: "effluent_flow",
};

// --- KSPCB CEM API CONFIGURATION ---
// Target: Seafood Park (India) Ltd (userName: SFP008)
const KSPCB_CEM_CONFIG = {
  url: "https://ebhoomcem.kspcb.kerala.gov.in/api/v1/dashboards/realtime-parameter",

  // ⚠️ IMPORTANT:
  // Fill these with the exact IDs from the KSPCB CEM portal for SFP008.
  // I'm putting placeholders now – change them to the correct values.
  productId: "PID-SFPIL",     // e.g. "PID-SFP008" or whatever they gave you
  stationId: "station_4214",    // e.g. "seafood_lab", "SFP008_STP", etc.
  industryId: "industry_4148",           // e.g. industry code in the portal
  userId: "SFPIL",            // KSPCB user id / login id if required

  // Match conditions from the MQTT payload
  targetUserName: "SFP008",
  targetProductId: "8", // this is from your payload: product_id: '8'
  targetStackName: "Effluent_SeafoodLab_Monitoring", // from your payload
};

/**
 * Send one stack's data to KSPCB CEM realtime API.
 * Expects payload similar to your `sensorPayload`.
 */
async function sendToKspcbCem(sensorPayload) {
  try {
    const { stacks, date, time } = sensorPayload;

    // Find the effluent stack for Seafood Lab
    const targetStack = stacks.find(
      (s) =>
        s.stackName === KSPCB_CEM_CONFIG.targetStackName &&
        (s.stationType === "effluent" || !s.stationType)
    );

    if (!targetStack) {
      console.log(
        "KSPCB CEM: No matching stack found for",
        KSPCB_CEM_CONFIG.targetStackName
      );
      return;
    }

    // Build the "values" object expected by KSPCB CEM
    // Adjust / add keys here depending on what they have enabled for this stack.
    const values = {};

    if (targetStack.TEMP !== undefined)
      values.TEMP = toNum(targetStack.TEMP, 0);
    if (targetStack.COD !== undefined)
      values.COD = toNum(targetStack.COD, 0);
    if (targetStack.BOD !== undefined)
      values.BOD = toNum(targetStack.BOD, 0);
    if (targetStack.TSS !== undefined)
      values.TSS = toNum(targetStack.TSS, 0);
    if (targetStack.TURB !== undefined)
      values.TURB = toNum(targetStack.TURB, 0);
    if (targetStack.pH !== undefined || targetStack.ph !== undefined)
      values.ph = toNum(targetStack.pH ?? targetStack.ph, 7);

    const cemPayload = {
      productId: KSPCB_CEM_CONFIG.productId,
      stationId: KSPCB_CEM_CONFIG.stationId,
      industryId: KSPCB_CEM_CONFIG.industryId,
      userId: KSPCB_CEM_CONFIG.userId,
      stackData: [
        {
          name: KSPCB_CEM_CONFIG.targetStackName,
          type: targetStack.stationType || "effluent",
          values,
          date, // 'DD/MM/YYYY'
          time, // 'HH:mm'
        },
      ],
    };

    console.log("Sending to KSPCB CEM:", JSON.stringify(cemPayload, null, 2));

    const resp = await axios.post(KSPCB_CEM_CONFIG.url, cemPayload, {
      headers: { "Content-Type": "application/json" },
      timeout: 10000,
    });

    console.log("✅ KSPCB CEM API success:", resp.data);
  } catch (err) {
    console.error(
      "❌ Error sending to KSPCB CEM:",
      err.response?.data || err.message
    );
  }
}


function debugLog(...args) {
  console.log("🛠️ DEBUG:", ...args);
}

// ---- numeric coercion helpers ----
const toNum = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const normalizeOnOff = (v) => {
  if (typeof v === "number") return v ? 1 : 0;
  if (typeof v === "boolean") return v ? 1 : 0;

  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["on", "1", "true", "open"].includes(s)) return 1;
    if (["off", "0", "false", "close"].includes(s)) return 0;
  }

  return undefined; // means "status missing/unknown"
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

// --- NEW: Function to send data to Aadhav API ---
// This extracts BOD, COD, TSS, pH from the "STP" / "effluent" stack
// And FLOW (flowRate), totalizer (cumulatingFlow) from the "STP outlet" / "effluent_flow" stack
// Matches the email format: industryId,stationId,timestamp,BOD|val,COD|val,TSS|val,pH|val,FLOW|val,totalizer|val
async function sendToAadhavApi(sensorData) {
  try {
    // Find pollution stack (STP / effluent)
    const pollutionStack = sensorData.find(stack =>
      stack.stackName === AADHAV_CONFIG.targetStackName &&
      stack.stationType === AADHAV_CONFIG.targetStationType &&
      (stack.BOD !== undefined || stack.COD !== undefined || stack.TSS !== undefined ||
        stack.pH !== undefined || stack.ph !== undefined)
    );

    // Find flow stack (STP outlet / effluent_flow)
    const flowStack = sensorData.find(stack =>
      stack.stackName === AADHAV_CONFIG.targetFlowStackName &&
      stack.stationType === AADHAV_CONFIG.targetFlowStationType &&
      (stack.flowRate !== undefined || stack.cumulatingFlow !== undefined)
    );

    if (!pollutionStack && !flowStack) {
      console.log("No relevant pollution or flow parameters/stacks found for Aadhav API");
      return;
    }

    // Extract pollution values (fallback to 0 or neutral if missing)
    const bod = toNum(pollutionStack?.BOD, 0);
    const cod = toNum(pollutionStack?.COD, 0);
    const tss = toNum(pollutionStack?.TSS, 0);
    const ph = toNum(pollutionStack?.pH || pollutionStack?.ph, 7); // Handle possible 'ph' lowercase

    // Extract flow values (fallback to 0 if missing)
    const flow = toNum(flowStack?.flowRate, 0); // FLOW = flowRate from STP outlet
    const totalizer = toNum(flowStack?.cumulatingFlow, 0); // totalizer = cumulatingFlow from STP outlet

    // Generate timestamp in IST (matches sample: YYYY-MM-DD HH:mm:ss)
    const timestamp = moment().tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss");

    // Build raw data string (exact format from email)
    const rawData = `${AADHAV_CONFIG.industryId},${AADHAV_CONFIG.stationId},${timestamp},BOD|${bod},COD|${cod},TSS|${tss},pH|${ph},FLOW|${flow},totalizer|${totalizer}`;

    // Base64 encode the raw data (matches email: data=base64_encode(raw))
    const encodedData = Buffer.from(rawData).toString("base64");

    // Build full URL with params
    const apiUrl = `${AADHAV_CONFIG.baseUrl}?key=${AADHAV_CONFIG.md5Key}&data=${encodedData}`;

    console.log("Sending to Aadhav API:", { rawData, encodedData, apiUrl });

    // Send GET request (as per sample URL structure)
    const response = await axios.get(apiUrl, { timeout: 10000 });

    if (response.status === 200) {
      console.log("✅ Aadhav API data sent successfully. Response:", response.data);
      // You can check response.data for specific success message if the API returns one (e.g., JSON or text like "success")
      // If the API returns a specific message, log or handle it here
    } else {
      console.error("❌ Aadhav API response error:", response.status, response.data);
    }

  } catch (error) {
    console.error("Error sending to Aadhav API:", error.response?.data || error.message);
    // Optional: Implement retry logic here if needed
  }
}

// --- 2. PUSH NOTIFICATION FUNCTION ---
// Add these constants at the top of your file for easy configuration
const LOW_FUEL_THRESHOLD = 30; // Notify when fuel is at or below this percentage
const REFUEL_RESET_THRESHOLD = 33; // Reset the alert when fuel is back above this percentage

// --- TANK ALERT THRESHOLDS ---
// You can tweak these numbers if needed
const TANK_LOW_25 = 25;     // around 25%
const TANK_CRITICAL_5 = 5;  // below 5%
const TANK_HIGH_85 = 85;    // above 85%
const TANK_CRITICAL_95 = 95;// at/above 95%

const CLIENT_BASE_URL = process.env.EMS_CLIENT_URL || "https://ems.ebhoom.com";
const FUEL_DASHBOARD_PATH = "/diesel";
const TANK_DASHBOARD_PATH = "/autonerve";

// Map percentage to a "band" label
function classifyTankBand(pct) {
  if (pct == null || !Number.isFinite(pct)) return "normal";

  if (pct <= TANK_CRITICAL_5) return "critical_low";
  if (pct >= TANK_CRITICAL_95) return "critical_high_95";

  return "normal";
}


async function triggerPushNotification(userName, fuelLevel) {
  // Exit early if fuelLevel data is missing
  if (fuelLevel === undefined) {
    return;
  }

  try {
    const user = await userdb.findOne({ userName: userName });

    // Exit if no user found
    if (!user) {
      return;
    }

    const hasSentLowFuelAlert = user.lowFuelNotificationSent || false;

    // --- 1. Check if a notification needs to be sent ---
    // Condition: Fuel is low AND we haven't sent an alert yet.
    if (fuelLevel <= LOW_FUEL_THRESHOLD && !hasSentLowFuelAlert) {
      if (user.pushSubscription) {
        const subscription = user.pushSubscription;
        const url = `${CLIENT_BASE_URL}${FUEL_DASHBOARD_PATH}`;

        const payload = JSON.stringify({
          title: "Low Fuel Alert",
          body: `Diesel is at ${fuelLevel}%. Please refill soon.`,
          url,
        });

        // Send the notification
        await webpush.sendNotification(subscription, payload);
        console.log(`Push notification sent successfully to ${userName}.`);
      }

      // IMPORTANT: Mark that the alert has been sent to prevent spam
      await userdb.updateOne({ userName: userName }, { $set: { lowFuelNotificationSent: true } });

      // --- 2. Check if the "sent" flag needs to be reset ---
      // Condition: Fuel has been refilled AND the alert flag is still active.
    } else if (fuelLevel >= REFUEL_RESET_THRESHOLD && hasSentLowFuelAlert) {
      await userdb.updateOne({ userName: userName }, { $set: { lowFuelNotificationSent: false } });
      console.log(`Low fuel alert flag has been reset for ${userName}.`);
    }

  } catch (error) {
    // --- 3. Handle errors, including expired subscriptions ---
    if (error.statusCode === 410) {
      // 410 Gone: The subscription is expired and invalid. Remove it.
      console.log(`Subscription for ${userName} has expired. Removing from DB.`);
      await userdb.updateOne(
        { userName: userName },
        { $unset: { pushSubscription: "" } }
      );
    } else {
      console.error(`Error processing push notification for ${userName}:`, error);
    }
  }
}

// Send tank-level alert to device user + their admin (via createdBy)
async function sendTankLevelAlert({ userDetails, tankName, percentage, band }) {
  // console.log("recieved######################################")
  if (!userDetails) return;

  const siteUserName = userDetails.userName;

  let title = "Tank Level Alert";
  let body = "";

  const pctText = `${Number(percentage).toFixed(1)}%`;

  switch (band) {
    case "critical_low":
      body = `${tankName} is below 5% (${pctText}). Critical low level.`;
      break;
    case "critical_high_95":
      body = `${tankName} is at/above 95% (${pctText}). Overflow risk!`;
      break;
    default:
      return; // only notify for these bands
  }

  // const url = "https://ems.ebhoom.com/autonerve"; // page to open on click
  const url = `${CLIENT_BASE_URL}${TANK_DASHBOARD_PATH}`;


  const payload = JSON.stringify({
    title,
    body,
    url,
  });

  const recipients = [];

  // 1️⃣ Add the site user (device owner)
  if (siteUserName) {
    recipients.push(userDetails);
  }

  // 2️⃣ Find the admin using createdBy (ObjectId of admin)
  let adminUser = null;
  try {
    let adminId = null;

    // support both: createdBy: ObjectId("...")  and  createdBy: { user: ObjectId("...") }
    if (userDetails.createdBy) {
      if (
        typeof userDetails.createdBy === "object" &&
        userDetails.createdBy.user
      ) {
        adminId = userDetails.createdBy.user;
      } else {
        adminId = userDetails.createdBy;
      }
    }

    if (adminId) {
      adminUser = await userdb.findById(adminId);
      if (adminUser) {
        recipients.push(adminUser);
      }
    }
  } catch (err) {
    console.error("Error fetching admin by createdBy:", err);
  }

  // Remove duplicates by _id (in case user == admin in some test data)
  const byId = new Map();
  recipients.forEach((u) => {
    if (u && u._id) byId.set(String(u._id), u);
  });

  for (const [, u] of byId.entries()) {
    const subscription = u.pushSubscription;
    if (!subscription) continue;

    try {
      await webpush.sendNotification(subscription, payload);
      console.log(
        `Tank alert sent to ${u.userName} (${tankName}, ${pctText}, band=${band})`
      );
    } catch (err) {
      if (err.statusCode === 410) {
        console.log(
          `Expired push subscription for ${u.userName}, removing from DB`
        );
        await userdb.updateOne(
          { _id: u._id },
          { $unset: { pushSubscription: "" } }
        );
      } else {
        console.error(
          "Error sending tank-level notification to",
          u.userName,
          err
        );
      }
    }
  }
}


// Check each tank and send notifications when crossing bands
// Check each tank and send notifications when crossing bands
async function handleTankAlerts(productId, userDetails, tankData, io) {
  if (!Array.isArray(tankData) || !tankData.length) return;

  for (const t of tankData) {
    const tankName = t.tankName || t.TankName || "Tank";
    const pct = toNum(t.percentage, null);
    if (pct == null) continue;

    const currentBand = classifyTankBand(pct); // "normal" / "critical_low" / "low_25" / "high_85" / "critical_high_95"
    const key = { productId: String(productId), tankName };

    // 🔹 Read last band from DB (default "normal")
    let state = await TankAlertState.findOne(key);
    const prevBand = state?.lastBand || "normal";

    // 🔹 If band did NOT change, do nothing (even if payload comes every 5s)
    if (prevBand === currentBand) {
      // console.log("Tank band unchanged → skipping alert", { productId, tankName, pct, band: currentBand });
      continue;
    }

    // 🔹 Always store latest band (including "normal")
    await TankAlertState.updateOne(
      key,
      { $set: { lastBand: currentBand } },
      { upsert: true }
    );

    // 🔹 If back to normal, just record and exit (no banner)
    if (currentBand === "normal") {
      console.log("Tank returned to normal band, no alert:", {
        productId,
        tankName,
        pct,
      });
      continue;
    }

    // 🔔 Now we know:
    //     - Band CHANGED
    //     - New band is NOT "normal"
    //     This covers:
    //       normal  → critical_low        (< 5%)
    //       low_25  → critical_low
    //       high_85 → critical_high_95    (>= 95%)
    //       normal  → critical_high_95
    //       etc.

    // 1) Push notification (if enabled)
    await sendTankLevelAlert({
      userDetails,
      tankName,
      percentage: pct,
      band: currentBand,
    });

    // 2) Socket.IO → frontend banner
    if (io) {
      const alertPayload = {
        product_id: String(productId),
        userName: userDetails.userName,
        email: userDetails.email,
        companyName: userDetails.companyName,
        industryType: userDetails.industryType,
        tankName,
        percentage: pct,
        band: currentBand,
        timestamp: new Date().toISOString(),
      };

      io.to(String(productId)).emit("tankAlert", alertPayload);
      console.log("Emitted tankAlert (band change):", alertPayload);
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
        console.log("✅ Parsed data (array):", JSON.stringify(data, null, 2));

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
          // 🔧 HANDLE VALVE ACK SENT AS pumps[]
          if (
            item.product_id &&
            Array.isArray(item.pumps) &&
            item.pumps.some(
              (p) =>
                typeof p.pumpId === "string" &&
                p.pumpId.startsWith("valve_") &&
                Object.prototype.hasOwnProperty.call(p, "status") &&
                p.status !== undefined &&
                p.status !== null &&
                String(p.status).trim() !== ""
            )
          ) {

            console.log("🟢 Processing VALVE ACK via pumps[]:", item);

            const valveAcks = item.pumps
              .filter((p) => p.pumpId?.startsWith("valve_"))
              .map((p) => {
                const norm = normalizeOnOff(p.status);

                return {
                  valveId: p.pumpId,
                  valveName: p.pumpName || p.pumpId,
                  status: norm, // ✅ 1/0 or undefined
                };
              });




            // ✅ Update DB ONLY if status is present
            for (const v of valveAcks) {
              if (typeof v.status === "undefined") continue;

              await valveStateController.updateValveState(item.product_id, v.valveId, v.status);
              await valveStateController.setValvePending(item.product_id, v.valveId, false);
            }
            console.log("valveAcks***********:", valveAcks);

            // ✅ Emit ONLY valves with defined status
            const realValveAcks = valveAcks.filter((v) => typeof v.status !== "undefined");
            console.log("realValveAcks***********:", realValveAcks);

            if (realValveAcks.length) {

              io.to(item.product_id.toString()).emit("valveAck", {
                product_id: item.product_id,
                valves: realValveAcks,
                timestamp: item.timestamp || new Date().toISOString(),
              });
            }


            // ✅ Emit proper valveAck to frontend
            // io.to(item.product_id.toString()).emit("valveAck", {
            //   product_id: item.product_id,
            //   valves: valveAcks,
            //   timestamp: item.timestamp || new Date().toISOString()
            // });

            console.log("✅ Valve ACK processed and forwarded:", valveAcks);

            continue;
          }
          // Pump acknowledgments (device confirming receipt/action of a command)
          if (item.product_id && Array.isArray(item.pumps)) {
            console.log("Processing pump acknowledgment:", item);

            //vibration
            //  await pumpDataController.savePumpMetrics(item);

            for (const pump of item.pumps) {
              try {
                const pumpstate = await pumpStateController.updatePumpState(
                  item.product_id,
                  pump.pumpId,
                  pump.status === 1 || pump.status === "ON"
                );
                console.log("Pump state updated from acknowledgment**:", pumpstate);
                // await updateRuntimeFromRealtime({
                //   product_id: item.product_id,
                //   userName: item.userName,
                //   pumpId: pump.pumpId,
                //   pumpName: pump.pumpName,
                //   status:
                //     pump.status === 1 || pump.status === "ON" ? "ON" : "OFF",
                //   timestamp:
                //     item.ntpTime || item.timestamp || new Date().toISOString(),
                // });
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
              cycle_status: item.cycle_status,
              filling_status: item.filling_status,
              tanks: item.tanks,
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
            // const now = moment().tz("Asia/Kolkata").toDate();
            // const key = `${item.product_id}_${item.userName}`;
            // if (lastProcessedTime[key] && now - lastProcessedTime[key] < 1000) {
            //   console.log("Throttling duplicate sensor/tank message:", item);
            //   continue;
            // }
            // lastProcessedTime[key] = now;

            // // split into sensor vs. tank
            // const sensorStacksRaw = item.stacks.filter((s) => !s.TankName);
            // const tankStacksRaw = item.stacks.filter((s) => !!s.TankName);
            const now = moment().tz("Asia/Kolkata").toDate();

            // split into sensor vs. tank
            const sensorStacksRaw = item.stacks.filter((s) => !s.TankName);
            const tankStacksRaw = item.stacks.filter((s) => !!s.TankName);

            // ✅ Decide separately whether to process sensor/tank (no cross-blocking)
            const processSensor =
              sensorStacksRaw.length &&
              !shouldDropDuplicate({
                productId: item.product_id,
                userName: item.userName,
                kind: "sensor",
                payload: sensorStacksRaw,
                windowMs: DEDUPE_MS_SENSOR,
              });

            const processTank =
              tankStacksRaw.length &&
              !shouldDropDuplicate({
                productId: item.product_id,
                userName: item.userName,
                kind: "tank",
                payload: tankStacksRaw,
                windowMs: DEDUPE_MS_TANK,
              });

            // If BOTH are duplicates, skip the item completely
            if (!processSensor && !processTank) {
              // (optional) keep quiet to avoid log spam
              // console.log("Dropping duplicate sensor+tank payload:", item.product_id, item.userName);
              continue;
            }


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
            if (processSensor) {
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

                // ✅ NEW: Emit flowmeter + psf related stacks to Canvas via product room
                // Frontend joins room using product_id (joinRoom)
                io.to(String(item.product_id)).emit("flometervalveData", {
                  product_id: String(item.product_id),
                  userName: item.userName,
                  stacks: sensorPayload.stacks, // contains STP + STP inlet/outlet/garden
                  timestamp: sensorPayload.timestamp || new Date().toISOString(),
                });
                console.log("✅ emitting flometervalveData to room:", item.product_id);

                // --- 3. TRIGGER PUSH NOTIFICATION ---
                // Extract the fuel level from the clean sensor data
                const latestSensorData = cleanSensor[0];
                if (latestSensorData) {
                  const fuelLevel = latestSensorData.fuel_level_percentage;
                  // Call the function to check and send a notification if needed
                  await triggerPushNotification(item.userName, fuelLevel);
                }
                // --- END TRIGGER ---

                // --- NEW: Send to Aadhav API if this matches the target India Land identifiers ---
                if (
                  userDetails.userName === AADHAV_CONFIG.targetUserName &&
                  userDetails.companyName === AADHAV_CONFIG.targetCompanyName &&
                  item.product_id === AADHAV_CONFIG.targetProductId
                ) {
                  await sendToAadhavApi(cleanSensor);
                }

                // --- NEW: Send Seafood Park (SFP008) data to KSPCB CEM realtime API ---
                // if (
                //   userDetails.userName === KSPCB_CEM_CONFIG.targetUserName &&
                //   item.product_id === KSPCB_CEM_CONFIG.targetProductId
                // ) {
                //   await sendToKspcbCem(sensorPayload);
                // }

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
            if (processTank) {

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
                console.log(room);
                io.to(room).emit("data", tankPayload);
                lastTankDataByProductId[room] = tankPayload;
                // 🔔 Check levels and send notifications to user + admin when thresholds are crossed
                await handleTankAlerts(item.product_id, userDetails, tankData, io);


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

    socket.on("controlValve", ({ product_id, valves, msgType }) => {
      console.log(
        `🧯 Socket controlValve received for product ${product_id}:`,
        valves
      );

      if (!product_id || !Array.isArray(valves) || !valves.length) {
        console.error("Invalid valve control request");
        return;
      }

      // Forward to MQTT exactly like pumps
      sendPumpControlMessage(product_id, valves, "valve");
    });


    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
    });
  });
};

// const sendPumpControlMessage = async (product_id, pumps) => {
//   const messageId = `cmd-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
//   const message = {
//     product_id,
//     pumps: pumps.map((p) => ({
//       pumpId: p.pumpId,
//       pumpName: p.pumpName,
//       status: p.status === "ON" ? 1 : 0,
//     })),
//     timestamp: new Date().toISOString(),
//     messageId,
//   };

//   try {
//     // Set the pending status to true in the database for each pump
//     for (const pump of pumps) {
//       await pumpStateController.setPumpPending(product_id, pump.pumpId, true);
//     }
//   } catch (err) {
//     console.error("Error setting pump pending status:", err);
//   }

//   // ... (rest of the sendPumpControlMessage function)
//   client.publish("ebhoomSub", JSON.stringify(message), { qos: 1 }, (err) => {
//     if (err) console.error("Error publishing pump control:", err);
//     else console.log("Pump command sent:", message);
//   });
// };

const normalizeCmdStatus = (v) => {
  if (typeof v === "number") return v ? 1 : 0;
  if (typeof v === "boolean") return v ? 1 : 0;

  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["on", "1", "true", "open"].includes(s)) return 1;
    if (["off", "0", "false", "close"].includes(s)) return 0;
  }

  return 0; // default safe
};

const sendPumpControlMessage = async (product_id, items) => {
  const messageId = `cmd-${Date.now()}-${Math.random()
    .toString(36)
    .substring(2, 9)}`;

  const message = {
    product_id,
    timestamp: new Date().toISOString(),
    messageId,

    // 🔥 UNIFIED STRUCTURE
    pumps: items.map((item) => ({
      pumpId: item.pumpId || item.valveId,   // valve_5 OR pump_1
      pumpName: item.pumpName || item.valveName,
      status: item.status === "ON" || item.status === 1 ? 1 : 0,
    })),
  };

  // 🔹 Set pending in DB
  try {
    for (const p of message.pumps) {
      if (p.pumpId.startsWith("valve_")) {
        await valveStateController.setValvePending(
          product_id,
          p.pumpId,
          true
        );
      } else {
        await pumpStateController.setPumpPending(
          product_id,
          p.pumpId,
          true
        );
      }
    }
  } catch (err) {
    console.error("Error setting pending state:", err);
  }

  // 🔹 Publish to MQTT
  client.publish("ebhoomSub", JSON.stringify(message), { qos: 1 }, (err) => {
    if (err) console.error("❌ Error publishing control:", err);
    else console.log("✅ Control message sent:", message);
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