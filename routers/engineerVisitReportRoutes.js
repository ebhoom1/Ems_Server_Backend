const express = require('express');
const { S3Client } = require('@aws-sdk/client-s3');
const multer = require('multer');
const multerS3 = require('multer-s3');
const { createEngineerVisitReport, getEngineerVisitReportByEquipment ,getEngineerVisitReportsByUserAndMonth,getEngineerVisitReportById,  updateEngineerVisitReport} = require('../controllers/engineerVisitReportController');

const router = express.Router();

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const BUCKET_NAME = "goodfoot-ems-bucket";

const upload = multer({
  storage: multerS3({
    s3,
    bucket: BUCKET_NAME,
    acl: "public-read",
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const timestamp = Date.now();
      const safe = file.originalname.replace(/\s+/g, "_");
      cb(null, `engineervisit/${timestamp}-${safe}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const uploadFields = upload.fields([
  { name: 'customerSignatureImage', maxCount: 1 },
  { name: 'engineerSignatureImage', maxCount: 1 }
]);

router.post('/add-engineerreport', uploadFields, createEngineerVisitReport);
router.get('/engineerreport/:equipmentId', getEngineerVisitReportByEquipment);
router.get(
  '/engineerreport/user/:userName/:year/:month',
  getEngineerVisitReportsByUserAndMonth
);
router.get('/engineerreport/id/:id', getEngineerVisitReportById);
router.patch('/engineerreport/:id', uploadFields, updateEngineerVisitReport);

module.exports = router;
