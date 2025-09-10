// scripts/migrateElectricalReports.js
require('dotenv').config();
const mongoose = require('mongoose');
const AWS = require('aws-sdk');
const ElectricalReport = require('../models/ElectricalReport');

// 1. Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.DB_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to MongoDB");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }
}

// 2. Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();
const BUCKET_NAME = process.env.S3_BUCKET_NAME_; // <-- use with underscore
const FILE_KEY = 'electrical_reports/reports.json';

// 3. Migration function
async function migrateReportsToS3() {
  try {
    const reports = await ElectricalReport.find().lean();
    if (!reports.length) {
      console.log("⚠️ No reports found in MongoDB.");
      return;
    }

    const params = {
      Bucket: BUCKET_NAME,
      Key: FILE_KEY,
      Body: JSON.stringify(reports, null, 2),
      ContentType: 'application/json',
    };

    await s3.upload(params).promise();
    console.log(`✅ Migrated ${reports.length} reports to S3 → ${BUCKET_NAME}/${FILE_KEY}`);

    // Optional: clear Mongo after verifying
    // await ElectricalReport.deleteMany({});
    // console.log("🗑️ Cleared reports from MongoDB");

  } catch (err) {
    console.error("❌ Migration failed:", err);
  } finally {
    mongoose.connection.close();
    console.log("🔌 MongoDB connection closed");
  }
}

// Run script
(async () => {
  await connectDB();
  await migrateReportsToS3();
})();
