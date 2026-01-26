// routes/treatedWaterClarityWeeklyRoutes.js
require("dotenv").config();
const express = require("express");
const { S3Client } = require("@aws-sdk/client-s3");
const multer = require("multer");
const multerS3 = require("multer-s3");

const {
  getTreatedWaterClarityWeeklyReport,
  uploadWeeklyTreatedWaterPhotos,
  deleteWeeklyTreatedWaterPhoto,
  getWeeklySignedUrls,
} = require("../controllers/treatedWaterClarityWeeklyController");

const router = express.Router();

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = "goodfoot-ems-bucket";

const clarityWeeklyPhotoUpload = multer({
  storage: multerS3({
    s3,
    bucket: BUCKET_NAME,
    acl: "public-read",
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const ts = Date.now();
      const safe = file.originalname.replace(/\s+/g, "_");
      const { userId, year, month, week, day } = req.params;
      cb(
        null,
        `treatedWaterClarityWeekly/${year}-${month}/week-${week}/${userId}/${day}/${ts}-${safe}`
      );
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Signed urls
router.post("/signed-urls", getWeeklySignedUrls);

// Get week report
// GET /api/treated-water-clarity-weekly/:userId/:year/:month/:week
router.get("/:userId/:year/:month/:week", getTreatedWaterClarityWeeklyReport);

// Upload (photos and/or comment) for a day in that week
// POST /api/treated-water-clarity-weekly/upload/:userId/:year/:month/:week/:day
router.post(
  "/upload/:userId/:year/:month/:week/:day",
  clarityWeeklyPhotoUpload.array("photos", 30),
  uploadWeeklyTreatedWaterPhotos
);

// Delete photo from a day
router.delete(
  "/photo/:userId/:year/:month/:week/:day",
  deleteWeeklyTreatedWaterPhoto
);

module.exports = router;
