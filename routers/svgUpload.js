const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// POST route to handle file upload (all types)
router.post('/upload-file', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded or invalid file type' });
  }

  const filePath = `/uploads/${req.file.filename}`;
  const fullUrl = `${req.protocol}://${req.get('host')}${filePath}`;
  res.status(200).json({ 
    filePath: fullUrl,
    fileName: req.file.filename,
    fileType: req.file.mimetype
  });
});

// GET route to list uploaded files
router.get('/list-uploaded-files', (req, res) => {
  fs.readdir(uploadDir, (err, files) => {
    if (err) return res.status(500).send('Failed to read uploads folder');
    
    const allowedExtensions = ['.svg', '.png', '.jpg', '.jpeg', '.pdf'];
    const filteredFiles = files.filter(f => {
      const ext = path.extname(f).toLowerCase();
      return allowedExtensions.includes(ext);
    });
    
    res.json(filteredFiles);
  });
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