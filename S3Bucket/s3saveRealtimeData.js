/* const AWS = require("aws-sdk");

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
  signatureVersion: "v4",   
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



const deleteRealtimeDataFromS3 = async ({ userName, date }) => {
  try {
    let allData = [];
  
    try {
      const existingFile = await s3
        .getObject({ Bucket: BUCKET, Key: FILE_KEY })
        .promise();
      allData = JSON.parse(existingFile.Body.toString("utf-8"));
    } catch (err) {
      if (err.code === "NoSuchKey") {
        console.log("ℹ️ File not found, so nothing to delete.");
        return { deletedCount: 0 };
      }
      throw err;
    }

    const initialCount = allData.length;
    if (initialCount === 0) {
      console.log("ℹ️ File is empty, nothing to delete.");
      return { deletedCount: 0 };
    }

   
    const dataToKeep = allData.filter(record => {
     
      const recordDate = record.timestamp.substring(0, 10);
      
      const userMatches = record.userName === userName;
      const dateMatches = recordDate === date;
      
    
      return !(userMatches && dateMatches);
    });

   
    const deletedCount = initialCount - dataToKeep.length;

    if (deletedCount > 0) {
      await s3
        .upload({
          Bucket: BUCKET,
          Key: FILE_KEY,
          Body: JSON.stringify(dataToKeep, null, 2),
          ContentType: "application/json",
        })
        .promise();
      console.log(`✅ Successfully deleted ${deletedCount} record(s) for user '${userName}' on date '${date}'.`);
    } else {
      console.log(`ℹ️ No records found matching user '${userName}' and date '${date}'. Nothing deleted.`);
    }

    return { deletedCount };

  } catch (err) {
    console.error(`❌ Error deleting realtime data for user '${userName}':`, err);
    throw err;
  }
};

module.exports = { saveRealtimeDataToS3 ,deleteRealtimeDataFromS3 };
 */



// ../S3Bucket/s3saveRealtimeData.js
const AWS = require('aws-sdk');
const moment = require('moment-timezone');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
  signatureVersion: 'v4',
});

const BUCKET = process.env.S3_BUCKET_NAME_ || 'ems-ebhoom-bucket';
const FILE_KEY = 'realtimedata/realtimeDataNew.json';

const saveRealtimeDataToS3 = async (payload) => {
  try {
    // Validate environment variables
    if (!process.env.AWS_ACCESS_KEY_ID) {
      throw new Error('AWS_ACCESS_KEY_ID environment variable is not set');
    }
    if (!process.env.AWS_SECRET_ACCESS_KEY) {
      throw new Error('AWS_SECRET_ACCESS_KEY environment variable is not set');
    }
    if (!process.env.AWS_REGION) {
      throw new Error('AWS_REGION environment variable is not set');
    }
    if (!process.env.S3_BUCKET_NAME_) {
      console.warn('S3_BUCKET_NAME_ not set, using default:', BUCKET);
    }

    // Log the incoming payload for debugging
    console.log('Received payload for S3 save:', JSON.stringify(payload, null, 2));

    // Ensure only energy-related stacks are saved
    const energyStacks = (payload.stacks || []).filter(
      (stack) => stack.stationType === 'energy' && stack.stackName === 'grid_energy'
    );

    if (!energyStacks.length) {
      console.warn('⚠️ No energy stacks found (stationType: energy, stackName: grid_energy), skipping S3 save.');
      return;
    }

    // Prepare the data to save
    const filteredPayload = {
      product_id: payload.product_id,
      userName: payload.userName,
      email: payload.email || 'N/A',
      mobileNumber: payload.mobileNumber || 'N/A',
      companyName: payload.companyName || 'N/A',
      industryType: payload.industryType || 'Other',
      stacks: energyStacks.map((stack) => ({
        stackName: stack.stackName,
        stationType: stack.stationType,
        energy: parseFloat(stack.energy) || 0,
        fuel_level_percentage: parseFloat(stack.fuel_level_percentage) || 0,
        fuel_volume_liters: parseFloat(stack.fuel_volume_liters) || 0,
        last_refill_time: stack.last_refill_time || null,
      })),
      timestamp: moment().tz('Asia/Kolkata').toISOString(true), // Use Kolkata (IST) time
    };

    // Log the filtered payload
    console.log('Filtered payload to save:', JSON.stringify(filteredPayload, null, 2));

    // Fetch existing data from S3
    let existingData = [];
    try {
      const existingFile = await s3
        .getObject({ Bucket: BUCKET, Key: FILE_KEY })
        .promise();
      existingData = JSON.parse(existingFile.Body.toString('utf-8'));
      if (!Array.isArray(existingData)) {
        console.warn('Existing data is not an array, initializing as empty array.');
        existingData = [];
      }
    } catch (err) {
      if (err.code === 'NoSuchKey') {
        console.log('ℹ️ Creating new realtimeData.json file.');
      } else {
        console.error('❌ Error fetching realtimeData.json:', err.message);
        return;
      }
    }

    // Append new data
    existingData.push(filteredPayload);

    // Upload updated data to S3
    const params = {
      Bucket: BUCKET,
      Key: FILE_KEY,
      Body: JSON.stringify(existingData, null, 2),
      ContentType: 'application/json',
    };

    console.log('S3 Upload Params:', {
      Bucket: params.Bucket,
      Key: params.Key,
      ContentType: params.ContentType,
    });

    await s3.upload(params).promise();
    console.log(`✅ Realtime energy data appended to S3: ${FILE_KEY}`);
  } catch (err) {
    console.error('❌ Error saving realtime data to S3:', err.message || err);
  }
};

module.exports = { saveRealtimeDataToS3 };