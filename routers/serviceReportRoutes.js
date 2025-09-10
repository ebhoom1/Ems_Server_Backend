// routes/serviceReportRoutes.js
require('dotenv').config(); // Load your .env first
const express = require('express');
const { S3Client } = require('@aws-sdk/client-s3'); // Import S3Client
const multer = require('multer'); // Import multer
const multerS3 = require('multer-s3'); // Import multerS3
const router = express.Router();

const {
  createServiceReport,
  getServiceReportsByEquipmentAndMonth,
  checkServiceReportExists,
  getReportsByUserAndMonth
} = require('../controllers/serviceReportController');

// REPLICATED PHOTO UPLOAD SETUP FROM mechanicalReportRoutes.js
// Initialize S3Client from AWS SDK v3
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const BUCKET_NAME = 'ems-ebhoom-bucket'; // Ensure this matches your bucket name

const photoUpload = multer({
  storage: multerS3({
    s3: s3, // Use the v3 S3 client here
    bucket: BUCKET_NAME,
    acl: 'public-read', // Note: ACLs are generally discouraged in v3 for new buckets.
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const timestamp = Date.now();
      const safeName = file.originalname.replace(/\s+/g, '_');
      cb(null, `service/${timestamp}-${safeName}`); // Use 'service' folder for service report photos
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB max per file
});
// END REPLICATED PHOTO UPLOAD SETUP

// Create a new service report (up to 10 general photos)
router.post(
  '/add-servicereport',
  photoUpload.array('photos', 10), // This middleware handles the 'photos' array from the form
  createServiceReport
);

// Check if a service report exists for equipment for a given month
router.get(
  '/exists/:equipmentId',
  checkServiceReportExists
);

// Get specific service report(s) for an equipment by month and year
router.get(
  '/equipment/:equipmentId',
  getServiceReportsByEquipmentAndMonth
);

// Get merged service reports for a user and month
router.get(
  '/user/:userName/month/:year/:month',
  getReportsByUserAndMonth
);

router.get('/hello', (req, res) => {
  res.json({ message: 'Hello from the backend API!' });
});


module.exports = router;