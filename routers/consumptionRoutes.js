const express = require("express");
const router = express.Router();
const AWS = require("aws-sdk");

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();
const BUCKET = process.env.S3_BUCKET_NAME_ || "goodfoot-ems-bucket";
const DEST_KEY = "dailyconsumption/consumptionData.json";

// GET /api/daily-consumption
router.get("/daily-consumption", async (req, res) => {
  try {
    const data = await s3
      .getObject({ Bucket: BUCKET, Key: DEST_KEY })
      .promise();

    const json = JSON.parse(data.Body.toString("utf-8"));
    res.json({ success: true, data: json });
  } catch (err) {
    if (err.code === "NoSuchKey") {
      return res.json({ success: true, data: [] });
    }
    console.error("❌ Error fetching daily consumption:", err);
    res.status(500).json({ success: false, error: "Failed to fetch daily consumption" });
  }
});
module.exports = router;
