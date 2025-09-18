// File: s3/saveRealtimeData.js
const AWS = require("aws-sdk");

// Create S3 client with explicit region & signature
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
  signatureVersion: "v4",   // important for ap-south-1
});

const BUCKET = process.env.S3_BUCKET_NAME_ || "ems-ebhoom-bucket";
const FILE_KEY = "realtimedata/realtimeData.json";

const saveRealtimeDataToS3 = async (payload) => {
  try {
    const energyStacks = (payload.stacks || []).filter(
      (s) => s.stationType === "energy"
    );

    if (!energyStacks.length) {
      console.log("⚠️ No energy stacks found, skipping S3 save.");
      return;
    }

    const filteredPayload = {
      product_id: payload.product_id,
      userName: payload.userName,
      email: payload.email,
      mobileNumber: payload.mobileNumber,
      companyName: payload.companyName,
      industryType: payload.industryType || "Other",
      stacks: energyStacks.map((s) => ({
        stackName: s.stackName,
        stationType: s.stationType,
        energy: s.energy,
        battery_voltage_v: s.battery_voltage_v,
        oil_pressure_psi: s.oil_pressure_psi,
        oil_pressure_bar: s.oil_pressure_bar,
        coolant_temp_celsius: s.coolant_temp_celsius,
        engine_rpm: s.engine_rpm,
        start_attempts: s.start_attempts,
        engine_hours: s.engine_hours,
        fuel_level_percentage: s.fuel_level_percentage,
        fuel_volume_liters: s.fuel_volume_liters,
      })),
      timestamp: new Date().toISOString(),
    };

    let existingData = [];
    try {
      const existingFile = await s3
        .getObject({ Bucket: BUCKET, Key: FILE_KEY })
        .promise();
      existingData = JSON.parse(existingFile.Body.toString("utf-8"));
    } catch (err) {
      if (err.code === "NoSuchKey") {
        console.log("ℹ️ Creating new realtimeData.json file.");
      } else {
        console.error("❌ Error fetching realtimeData.json:", err);
        return;
      }
    }

    existingData.push(filteredPayload);

    await s3
      .upload({
        Bucket: BUCKET,
        Key: FILE_KEY,
        Body: JSON.stringify(existingData, null, 2),
        ContentType: "application/json",
      })
      .promise();

    console.log("✅ Realtime energy data appended to S3:", FILE_KEY);
  } catch (err) {
    console.error("❌ Error saving realtime data to S3:", err);
  }
};

module.exports = { saveRealtimeDataToS3 };
