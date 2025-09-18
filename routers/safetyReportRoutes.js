// const express = require("express");
// const { S3Client } = require("@aws-sdk/client-s3");
// const multer = require("multer");
// const multerS3 = require("multer-s3");
// const { createSafetyReport, getSafetyReportByEquipment } = require("../controllers/safetyReportController");

// const router = express.Router();

// const s3 = new S3Client({
//   region: process.env.AWS_REGION,
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//   },
// });
// const BUCKET_NAME = "ems-ebhoom-bucket";

// const upload = multer({
//   storage: multerS3({
//     s3,
//     bucket: BUCKET_NAME,
//     acl: "public-read",
//     contentType: multerS3.AUTO_CONTENT_TYPE,
//     key: (req, file, cb) => {
//       const timestamp = Date.now();
//       const safe = file.originalname.replace(/\s+/g, "_");
//       cb(null, `safety/${timestamp}-${safe}`);
//     },
//   }),
//   limits: { fileSize: 10 * 1024 * 1024 },
// });

// const uploadFields = upload.fields([
//   { name: 'photos', maxCount: 20 },
//   { name: 'customerSignatureImage', maxCount: 1 },
//   { name: 'engineerSignatureImage', maxCount: 1 }
// ]);

// router.post("/add-safetyreport", uploadFields, createSafetyReport);
// router.get("/safetyreport/:equipmentId", getSafetyReportByEquipment);

// module.exports = router;


const express = require("express");
const { S3Client } = require("@aws-sdk/client-s3");
const multer = require("multer");
const multerS3 = require("multer-s3");
const { createSafetyReport, getSafetyReportByEquipment,getReportsByUserMonth } = require("../controllers/safetyReportController");

const router = express.Router();

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const BUCKET_NAME = "ems-ebhoom-bucket";

const upload = multer({
  storage: multerS3({
    s3,
    bucket: BUCKET_NAME,
    acl: "public-read",
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const timestamp = Date.now();
      const safe = file.originalname.replace(/\s+/g, "_");
      cb(null, `safety/${timestamp}-${safe}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const uploadFields = upload.fields([
  { name: "customerSignatureImage", maxCount: 1 },
  { name: "engineerSignatureImage", maxCount: 1 }
]);

router.post("/add-safetyreport", uploadFields, createSafetyReport);
router.get("/safetyreport/:equipmentId", getSafetyReportByEquipment);
router.get("/safetyreport/user/:user/:year/:month", getReportsByUserMonth);


module.exports = router;
