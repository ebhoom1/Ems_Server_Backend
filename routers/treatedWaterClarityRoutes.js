// routes/treatedWaterClarityRoutes.js
require("dotenv").config();
const express = require("express");
const { S3Client } = require("@aws-sdk/client-s3");
const multer = require("multer");
const multerS3 = require("multer-s3");

const {
  getTreatedWaterClarityReport,
  uploadTreatedWaterPhotos,
  deleteTreatedWaterPhoto,
} = require("../controllers/treatedWaterClarityController");

const router = express.Router();

// --- AWS S3 CONFIG (same style as your other routes) ---
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = "ems-ebhoom-bucket";

// Multer-S3 storage for treated water clarity photos
const clarityPhotoUpload = multer({
  storage: multerS3({
    s3,
    bucket: BUCKET_NAME,
    acl: "public-read",
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const ts = Date.now();
      const safe = file.originalname.replace(/\s+/g, "_");
      const { userId, year, month, day } = req.params;
      cb(
        null,
        `treatedWaterClarity/${year}-${month}/${userId}/${day}/${ts}-${safe}`
      );
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// --- ROUTES ---

// Get full month report for a site
// GET /api/treated-water-clarity/:userId/:year/:month
router.get("/:userId/:year/:month", getTreatedWaterClarityReport);

// Upload photos for a specific day
// POST /api/treated-water-clarity/upload/:userId/:year/:month/:day
router.post(
  "/upload/:userId/:year/:month/:day",
  clarityPhotoUpload.array("photos", 10),
  uploadTreatedWaterPhotos
);

router.delete(
  "/photo/:userId/:year/:month/:day",
  deleteTreatedWaterPhoto
);

module.exports = router;
