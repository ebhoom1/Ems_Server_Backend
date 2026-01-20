// FILE: routes/weeklyMaintenanceRoutes.js

require("dotenv").config();
const express = require("express");
const { S3Client } = require("@aws-sdk/client-s3");
const multer = require("multer");
const multerS3 = require("multer-s3");

const router = express.Router();

const {
  saveOrUpdateReport,
  getReport,
  addPhotosToDate,
  deletePhotoFromDate,
  getSignedUrls,
} = require("../controllers/weeklyMaintenanceReportController");

// --- AWS S3 CONFIG ---
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || "goodfoot-ems-bucket";

// --- Multer-S3 setup ---
const photoUpload = multer({
  storage: multerS3({
    s3,
    bucket: BUCKET_NAME,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const ts = Date.now();
      const safe = file.originalname.replace(/\s+/g, "_");
      const { userId, weekStart, dateISO } = req.params;
      cb(null, `weeklyMaintenance/${userId}/${weekStart}/${dateISO}/${ts}-${safe}`);
    },
  }),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB per file
    files: 30, // max 30 files
  },
});

// --- Routes ---
router.post("/", saveOrUpdateReport);
router.get("/:userId/:weekStart", getReport);

// Upload photos for a date in that week
router.post(
  "/upload/:userId/:weekStart/:dateISO",
  (req, res, next) => {
    photoUpload.array("photos", 30)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            message: "One or more images exceed allowed size",
          });
        }
      }
      next(err);
    });
  },
  addPhotosToDate
);

// Delete photo from a date
router.delete("/photo/:userId/:weekStart/:dateISO", deletePhotoFromDate);

// Signed urls
router.post("/signed-urls", getSignedUrls);

module.exports = router;
