

// routes/serviceReportRoutes.js
require('dotenv').config();
const express = require('express');
const { S3Client } = require('@aws-sdk/client-s3');
const multer = require('multer');
const multerS3 = require('multer-s3');
const router = express.Router();

const {
  createServiceReport,
  getServiceReportsByEquipmentAndMonth,
  checkServiceReportExists,
  getReportsByUserAndMonth,
  getNextServiceReportSeq,     // NEW
} = require('../controllers/serviceReportController');

// S3 client
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const BUCKET_NAME = 'goodfoot-ems-bucket';

const photoUpload = multer({
  storage: multerS3({
    s3,
    bucket: BUCKET_NAME,
    acl: 'public-read',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const timestamp = Date.now();
      const safe = file.originalname.replace(/\s+/g, '_');
      cb(null, `service/${timestamp}-${safe}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Accept multiple groups + signatures
const uploadFields = photoUpload.fields([
  { name: 'photos', maxCount: 20 },
  { name: 'issuePhotos', maxCount: 20 },
  { name: 'beforeImages', maxCount: 20 },
  { name: 'afterImages', maxCount: 20 },
  { name: 'customerSignatureImage', maxCount: 1 },     
  { name: 'technicianSignatureImage', maxCount: 1 },   // NEW
]);

router.post('/add-servicereport', uploadFields, createServiceReport);

// New series-number endpoint
router.get('/service-reports/next-seq', getNextServiceReportSeq);

router.get('/exists/:equipmentId', checkServiceReportExists);
router.get('/equipment/:equipmentId', getServiceReportsByEquipmentAndMonth);
router.get('/user/:userName/month/:year/:month', getReportsByUserAndMonth);

router.get('/hello', (req, res) => res.json({ message: 'Hello from the backend API!' }));

module.exports = router;

