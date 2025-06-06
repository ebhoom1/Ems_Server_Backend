require("dotenv").config();
const express = require("express");
const { S3Client } = require("@aws-sdk/client-s3");
const multer = require("multer");
const multerS3 = require("multer-s3");
const router = express.Router();
const ctrl = require("../controllers/dailyLogController");

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const BUCKET_NAME = "ems-ebhoom-bucket";

const imageUpload = multer({
  storage: multerS3({
    s3,
    bucket: BUCKET_NAME,
    acl: "public-read",
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const timestamp = Date.now();
      const safeName = file.originalname.replace(/\s+/g, "_");
      cb(null, `dailylog/${timestamp}-${safeName}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

// POST   /api/dailyLogs       → create a log
router.post("/add-dailylog", ctrl.createDailyLog);

// GET    /api/dailyLogs       → list all logs
router.get("/getdailylog", ctrl.getDailyLogs);

// GET    /api/dailyLogs/:id   → one log by ID
router.get("/getdailyLogById:id", ctrl.getDailyLogById);

// PUT    /api/dailyLogs/:id   → update
router.put("/updateDailyLogById:id", ctrl.updateDailyLog);

// DELETE /api/dailyLogs/:id   → delete
router.delete("/delete-dailyLogById:id", ctrl.deleteDailyLog);

router.get("/getdailylogByUsername/:username", ctrl.getDailyLogsByUsername);

router.get("/:companyName/:date", ctrl.getDailyLogByCompanyAndDate);

router.put(
  "/upsert-dailylog",
  imageUpload.array("images", 5),
  ctrl.upsertDailyLog
);

module.exports = router;