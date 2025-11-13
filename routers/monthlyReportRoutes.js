require('dotenv').config();
const express = require('express');
const { S3Client } = require('@aws-sdk/client-s3');
const multer = require('multer');
const multerS3 = require('multer-s3');
const router = express.Router();
const MonthlyReport = require('../models/MonthlyReport');
const { saveOrUpdateReport, getReport } = require('../controllers/monthlyReportController');

// --- AWS S3 CONFIG ---
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const BUCKET_NAME = 'ems-ebhoom-bucket';

// --- Multer-S3 setup (same style as service reports) ---
const photoUpload = multer({
  storage: multerS3({
    s3,
    bucket: BUCKET_NAME,
    acl: 'public-read',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const ts = Date.now();
      const safe = file.originalname.replace(/\s+/g, '_');
      cb(null, `monthlyReports/${ts}-${safe}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// --- Standard report routes ---
router.post('/', saveOrUpdateReport);
router.get('/:userName/:year/:month', getReport);

// --- 🆕 S3 photo upload route ---
router.post(
  '/upload/:userId/:year/:month',
  photoUpload.array('photos', 5),
  async (req, res) => {
    try {
      const { userId, year, month } = req.params;
      const photoUrls = req.files.map((f) => f.location); // S3 public URLs

      const updated = await MonthlyReport.findOneAndUpdate(
        { userId, year, month },
        { $set: { photos: photoUrls } },
        { new: true, upsert: false }
      );

      if (!updated)
        return res.status(404).json({ message: 'Report not found.' });

      res.status(200).json({
        success: true,
        message: 'Photos uploaded successfully',
        photos: updated.photos,
      });
    } catch (err) {
      console.error('Error uploading monthly report photos:', err);
      res.status(500).json({ message: 'Upload failed' });
    }
  }
);

module.exports = router;
