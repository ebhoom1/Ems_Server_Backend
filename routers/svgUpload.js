


const express = require('express');
const router = express.Router();
const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME_ || 'goodfoot-ems-bucket';

const allowedMimeTypes = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/svg+xml',
  'application/pdf',
];

// 🔹 Configure Multer for S3
const upload = multer({
  storage: multerS3({
    s3,
    bucket: BUCKET_NAME,
    acl: 'public-read',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const timestamp = Date.now();
      const safeName = file.originalname.replace(/\s+/g, '_');
      cb(null, `uploads/${timestamp}-${safeName}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only images and PDFs are allowed'));
  },
});


// Ensure uploads folder exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only SVG, PNG, JPG, and PDF files are allowed'));
  }
};


/// 📤 POST: Upload file to S3
router.post('/upload-file', upload.single('file'), (req, res) => {
  if (!req.file || !req.file.location) {
    return res.status(400).json({ message: 'Upload failed or invalid file' });
  }

  res.status(200).json({
    filePath: req.file.location, // public S3 URL
    fileName: path.basename(req.file.key),
    fileType: req.file.mimetype,
  });
});

// 📜 GET: List uploaded files (from S3)
const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
router.get('/list-uploaded-files', async (req, res) => {
  try {
    const data = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: 'uploads/',
      })
    );

    const files = (data.Contents || [])
      .filter((obj) =>
        ['.png', '.jpg', '.jpeg', '.svg', '.pdf'].includes(
          path.extname(obj.Key).toLowerCase()
        )
      )
      .map((obj) => ({
        name: path.basename(obj.Key),
        url: `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${obj.Key}`,
      }));

    res.json(files);
  } catch (err) {
    console.error('Error listing files:', err);
    res.status(500).json({ message: 'Failed to list files' });
  }
});

// Keep the old SVG endpoints for backward compatibility
router.post('/upload-svg', upload.single('svg'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const filePath = `/uploads/${req.file.filename}`;
  const fullUrl = `${req.protocol}://${req.get('host')}${filePath}`;
  res.status(200).json({ filePath: fullUrl });
});

router.get('/list-uploaded-svgs', (req, res) => {
  fs.readdir(uploadDir, (err, files) => {
    if (err) return res.status(500).send('Failed to read uploads folder');
    const svgFiles = files.filter(f => f.endsWith('.svg'));
    res.json(svgFiles);
  });
});

module.exports = router;


