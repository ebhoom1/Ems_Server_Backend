// routes/monthlyReportRoutes.js
require('dotenv').config();
const express = require('express');
const { S3Client } = require('@aws-sdk/client-s3');
const multer = require('multer');
const multerS3 = require('multer-s3');

const router = express.Router();
const {
  saveOrUpdateReport,
  getReport,
  addPhotosToDate,
  deletePhotoFromDate,
} = require('../controllers/monthlyMaintenanceReportController');

// --- AWS S3 CONFIG ---
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = 'ems-ebhoom-bucket';

// --- Multer-S3 setup ---
// const photoUpload = multer({
//   storage: multerS3({
//     s3,
//     bucket: BUCKET_NAME,
//     acl: 'public-read',
//     contentType: multerS3.AUTO_CONTENT_TYPE,
//     key: (req, file, cb) => {
//       const ts = Date.now();
//       const safe = file.originalname.replace(/\s+/g, '_');
//       const { userId, year, month, day } = req.params;

//       cb(
//         null,
//         `monthlyMaintenance/${userId}/${year}-${month}-${day}/${ts}-${safe}`
//       );  
//     },
//   }),
//   limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
// });
const photoUpload = multer({
  storage: multerS3({
    s3,
    bucket: BUCKET_NAME,
    acl: 'public-read',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const ts = Date.now();
      const safe = file.originalname.replace(/\s+/g, '_');
      const { userId, year, month, day } = req.params;
      cb(null, `monthlyMaintenance/${userId}/${year}-${month}-${day}/${ts}-${safe}`);
    },
  }),
  limits: {
    fileSize: 25 * 1024 * 1024,   // ✅ 25 MB PER FILE
    files: 30                     // ✅ explicitly allow 30 files
  },
});


// --- Standard report routes ---
router.post('/', saveOrUpdateReport);
router.get('/:userId/:year/:month', getReport);

// --- S3 photo upload route (per date) ---
// field name: "photos"
// router.post(
//   '/upload/:userId/:year/:month/:day',
//   photoUpload.array('photos', 30),
//   addPhotosToDate
// );
router.post(
  '/upload/:userId/:year/:month/:day',
  (req, res, next) => {
    photoUpload.array('photos', 30)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            message: 'One or more images exceed allowed size',
          });
        }
      }
      next(err);
    });
  },
  addPhotosToDate
);


router.delete(
  '/photo/:userId/:year/:month/:day',
  deletePhotoFromDate
);

module.exports = router;
