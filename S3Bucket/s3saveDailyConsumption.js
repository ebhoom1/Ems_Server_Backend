// File: s3/saveDailyConsumption.js
const AWS = require("aws-sdk");
const cron = require("node-cron");
const moment = require("moment-timezone");

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
  signatureVersion: "v4",
});

const BUCKET = process.env.S3_BUCKET_NAME_ || "goodfoot-ems-bucket";
const SOURCE_KEY = "realtimedata/realtimeData.json";
const DEST_KEY = "dailyconsumption/consumptionData.json";

// Fetch realtime data
async function fetchRealtimeData() {
  try {
    const data = await s3.getObject({ Bucket: BUCKET, Key: SOURCE_KEY }).promise();
    return JSON.parse(data.Body.toString("utf-8"));
  } catch (err) {
    if (err.code === "NoSuchKey") {
      console.log("⚠️ No realtimeData.json found.");
      return [];
    }
    throw err;
  }
}

// Fetch daily consumption file
async function fetchDailyConsumption() {
  try {
    const data = await s3.getObject({ Bucket: BUCKET, Key: DEST_KEY }).promise();
    return JSON.parse(data.Body.toString("utf-8"));
  } catch (err) {
    if (err.code === "NoSuchKey") {
      return [];
    }
    throw err;
  }
}

// Save daily consumption back
async function saveDailyConsumption(data) {
  const params = {
    Bucket: BUCKET,
    Key: DEST_KEY,
    Body: JSON.stringify(data, null, 2),
    ContentType: "application/json",
  };
  await s3.upload(params).promise();
  console.log("✅ Daily consumption updated:", DEST_KEY);
}

// Calculate
async function calculateDailyConsumption() {
  try {
    const realtimeData = await fetchRealtimeData();
    if (!realtimeData.length) {
      console.log("⚠️ No realtime data to process.");
      return;
    }

    const grouped = {};
    for (const entry of realtimeData) {
      const date = moment(entry.timestamp).tz("Asia/Kolkata").format("YYYY-MM-DD");
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(entry);
    }

    const dailyConsumption = await fetchDailyConsumption();

    for (const [date, entries] of Object.entries(grouped)) {
      entries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      const first = entries[0];
      const last = entries[entries.length - 1];

      const dailyEnergy = (last.stacks[0]?.energy || 0) - (first.stacks[0]?.energy || 0);
      const dailyFuel = (first.stacks[0]?.fuel_volume_liters || 0) - (last.stacks[0]?.fuel_volume_liters || 0);

      if (!dailyConsumption.find((d) => d.date === date)) {
        dailyConsumption.push({
          date,
          product_id: first.product_id,
          userName: first.userName,
          companyName: first.companyName,
          dailyEnergy,
          dailyFuel,
          startEnergy: first.stacks[0]?.energy,
          endEnergy: last.stacks[0]?.energy,
          startFuel: first.stacks[0]?.fuel_volume_liters,
          endFuel: last.stacks[0]?.fuel_volume_liters,
        });
      }
    }

    await saveDailyConsumption(dailyConsumption);
  } catch (err) {
    console.error("❌ Error in calculateDailyConsumption:", err);
  }
}

// Cron daily
function setupDailyConsumptionCron() {
  cron.schedule(
    "59 23 * * *",
    () => {
      const currentTimeIST = moment().tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss");
      console.log(`⏰ Running daily consumption calc at IST: ${currentTimeIST}`);
      calculateDailyConsumption();
    },
    { timezone: "Asia/Kolkata" }
  );
}


module.exports = { calculateDailyConsumption, setupDailyConsumptionCron };
