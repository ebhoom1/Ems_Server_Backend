// routes/mechanicalReportRoutes.js
require('dotenv').config(); // <-- load your .env first
const express = require('express');
// CHANGE 1: Import S3Client and Upload from AWS SDK v3
const { S3Client } = require('@aws-sdk/client-s3');
const multer = require('multer');
const multerS3 = require('multer-s3');
const router = express.Router();

const {
  addMechanicalReport,
  getMechanicalReports,
  getReportsByEquipment,
  getReportsByMonth,
  getReportsByUserAndMonth
} = require('../controllers/mechanicalReportController');


// CHANGE 2: Initialize S3Client from AWS SDK v3
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const BUCKET_NAME = 'ems-ebhoom-bucket';

const photoUpload = multer({
  storage: multerS3({
    s3: s3, // <-- Use the v3 S3 client here
    bucket: BUCKET_NAME,
    acl: 'public-read', // Note: ACLs are generally discouraged in v3 for new buckets. Consider using bucket policies.
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const timestamp = Date.now();
      const safeName = file.originalname.replace(/\s+/g, '_');
      cb(null, `mechanical/${timestamp}-${safeName}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 } // 5 MB max per file
});



// 3.1 Create new report (up to 10 photos)
router.post(
  '/add-mechanicalreport',
  photoUpload.array('photos', 10),
  addMechanicalReport
);

// 3.2 Get all reports
router.get(
  '/mechanicalreports',
  getMechanicalReports
);

// 3.3 Get reports by equipment ID
router.get(
  '/mechanicalreports/:equipmentId',
  getReportsByEquipment
);

// 3.4 Get reports by year/month
router.get(
  '/mechanicalreports/user/:userName/month/:year/:month',
  getReportsByUserAndMonth
);



module.exports = router;