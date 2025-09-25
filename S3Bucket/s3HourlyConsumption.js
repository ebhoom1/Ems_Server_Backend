// S3Bucket/s3HourlyConsumption.js
const AWS = require("aws-sdk");
const moment = require("moment-timezone");

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
  signatureVersion: "v4",
});

const SOURCE_BUCKET = process.env.S3_BUCKET_NAME_ || "ems-ebhoom-bucket";
const SOURCE_KEY = "realtimedata/realtimeDataNew.json";
const DEST_BUCKET = process.env.S3_BUCKET_NAME_ || "ems-ebhoom-bucket";
const DEST_KEY = "hourly-consumption/hour.json";

const calculateAndSaveHourlyConsumption = async () => {
  console.log("Starting hourly consumption calculation for userName: BBUSER...");

  try {
    const now = moment().tz("Asia/Kolkata");
    const startOfHour = now.clone().startOf("hour");
    const endOfHour = now.clone().endOf("hour");

    console.log(`Processing data for hour: ${startOfHour.format()} to ${endOfHour.format()}`);

    let allRealtimeData = [];
    try {
      const existingFile = await s3
        .getObject({ Bucket: SOURCE_BUCKET, Key: SOURCE_KEY })
        .promise();
      allRealtimeData = JSON.parse(existingFile.Body.toString("utf-8"));
    } catch (err) {
      if (err.code === "NoSuchKey") {
        console.log("Realtime data file not found, skipping calculation.");
        return;
      }
      throw err;
    }

    const lastHourData = allRealtimeData.filter((item) => {
      const itemTimestamp = moment.tz(item.timestamp, "Asia/Kolkata");
      const isInRange = itemTimestamp.isBetween(startOfHour, endOfHour, undefined, "[]");
      return item.userName === "BBUSER" && isInRange;
    });

    console.log(`Found ${lastHourData.length} records for user 'BBUSER' in the current hour.`);

    if (lastHourData.length === 0) {
      console.log("No data found for user 'BBUSER' in the current hour.");
      return;
    }

    const groupedByProduct = lastHourData.reduce((acc, item) => {
      const key = item.product_id;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    }, {});

    const hourlySummaries = [];

    for (const productId in groupedByProduct) {
      const records = groupedByProduct[productId];
      if (records.length < 2) {
        console.log(`Skipping product_id ${productId}: Only ${records.length} record(s) found.`);
        continue;
      }

      records.sort((a, b) => moment(a.timestamp).valueOf() - moment(b.timestamp).valueOf());

      const firstRecord = records[0].stacks[0];
      const lastRecord = records[records.length - 1].stacks[0];

      const startEnergy = parseFloat(firstRecord.energy) || 0;
      const endEnergy = parseFloat(lastRecord.energy) || 0;
      const energyConsumption = endEnergy > startEnergy ? endEnergy - startEnergy : 0;

      let fuelConsumption = 0;
      let startFuel = parseFloat(records[0].stacks[0].fuel_volume_liters) || 0;
      let endFuel = parseFloat(records[records.length - 1].stacks[0].fuel_volume_liters) || 0;

      for (let i = 1; i < records.length; i++) {
        const prevFuel = parseFloat(records[i - 1].stacks[0].fuel_volume_liters) || 0;
        const currentFuel = parseFloat(records[i].stacks[0].fuel_volume_liters) || 0;
        if (currentFuel < prevFuel && prevFuel - currentFuel < 100) {
          fuelConsumption += prevFuel - currentFuel;
        }
      }

      hourlySummaries.push({
        product_id: productId,
        userName: records[0].userName,
        companyName: records[0].companyName,
        timestamp_hour: startOfHour.toISOString(true),
        hour: startOfHour.format("HH"),
        energy: {
          startEnergy: startEnergy.toFixed(2),
          endEnergy: endEnergy.toFixed(2),
          consumption_kWh: energyConsumption.toFixed(2),
        },
        fuel: {
          startFuel_liters: startFuel.toFixed(2),
          endFuel_liters: endFuel.toFixed(2),
          consumption_liters: fuelConsumption.toFixed(2),
        },
      });
    }

    if (hourlySummaries.length === 0) {
      console.log("No valid hourly summaries to save.");
      return;
    }

    let existingData = [];
    try {
      const existingDestFile = await s3
        .getObject({ Bucket: DEST_BUCKET, Key: DEST_KEY })
        .promise();
      existingData = JSON.parse(existingDestFile.Body.toString("utf-8"));
    } catch (err) {
      if (err.code === "NoSuchKey") {
        console.log(`Destination file ${DEST_KEY} not found. A new one will be created.`);
      } else {
        throw err;
      }
    }

    const uniqueData = [];
    const seenKeys = new Set();
    for (const item of [...existingData, ...hourlySummaries]) {
      const key = `${item.userName}-${item.product_id}-${item.timestamp_hour}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        uniqueData.push(item);
      } else {
        console.warn(`Duplicate record found for ${key}, keeping latest.`);
      }
    }

    await s3.upload({
      Bucket: DEST_BUCKET,
      Key: DEST_KEY,
      Body: JSON.stringify(uniqueData, null, 2),
      ContentType: "application/json",
    }).promise();

    console.log(`✅ Successfully appended ${hourlySummaries.length} new record(s) to ${DEST_KEY}`);
  } catch (err) {
    console.error("❌ Error in hourly consumption calculation:", err);
  }
};

const getHourlyConsumptionData = async ({ userName, startDate, endDate }) => {
  if (!userName) {
    throw new Error("userName is a required parameter.");
  }

  console.log(`Fetching hourly data for user '${userName}'...`);

  try {
    const file = await s3
      .getObject({ Bucket: DEST_BUCKET, Key: DEST_KEY })
      .promise();

    const allHourlyData = JSON.parse(file.Body.toString("utf-8"));

    let filteredData = allHourlyData.filter((item) => item.userName === userName);

    if (startDate) {
      const start = moment.tz(startDate, "Asia/Kolkata").startOf("day");
      filteredData = filteredData.filter((item) =>
        moment.tz(item.timestamp_hour, "Asia/Kolkata").isSameOrAfter(start)
      );
    }

    if (endDate) {
      const end = moment.tz(endDate, "Asia/Kolkata").endOf("day");
      filteredData = filteredData.filter((item) =>
        moment.tz(item.timestamp_hour, "Asia/Kolkata").isSameOrBefore(end)
      );
    }

    console.log(`Found ${filteredData.length} records matching the criteria.`);
    return filteredData;
  } catch (err) {
    if (err.code === "NoSuchKey") {
      console.log(`Data file ${DEST_KEY} not found. Returning empty array.`);
      return [];
    }
    console.error("❌ Error fetching hourly consumption data:", err);
    throw err;
  }
};

const getHourlyConsumptionDataByDate = async ({ userName, date }) => {
  if (!userName || !date) {
    throw new Error("userName and date are required parameters.");
  }

  console.log(`Fetching hourly data for user '${userName}' on date '${date}'...`);

  try {
    const file = await s3
      .getObject({ Bucket: DEST_BUCKET, Key: DEST_KEY })
      .promise();

    const allHourlyData = JSON.parse(file.Body.toString("utf-8"));

    const requestedDate = moment.tz(date, "Asia/Kolkata").format("YYYY-MM-DD");

    const filteredData = allHourlyData
      .filter((item) => {
        const itemDate = moment.tz(item.timestamp_hour, "Asia/Kolkata").format("YYYY-MM-DD");
        return item.userName === userName && itemDate === requestedDate;
      })
      .sort((a, b) => moment(a.timestamp_hour).valueOf() - moment(b.timestamp_hour).valueOf());

    // Deduplicate by userName, product_id, and timestamp_hour
    const uniqueData = [];
    const seenKeys = new Set();
    for (const item of filteredData) {
      const key = `${item.userName}-${item.product_id}-${item.timestamp_hour}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        uniqueData.push(item);
      } else {
        console.warn(`Duplicate record found for ${key}, keeping first.`);
      }
    }

    console.log(`Found ${uniqueData.length} records for user '${userName}' on date '${date}'.`);
    return uniqueData;
  } catch (err) {
    if (err.code === "NoSuchKey") {
      console.log(`Data file ${DEST_KEY} not found. Returning empty array.`);
      return [];
    }
    console.error("❌ Error fetching hourly consumption data by date:", err, err.stack);
    return [];
  }
};

module.exports = { calculateAndSaveHourlyConsumption, getHourlyConsumptionData, getHourlyConsumptionDataByDate };