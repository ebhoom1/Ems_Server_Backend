const AWS = require('aws-sdk');
const multer = require('multer');
const LiveStation = require('../models/LiveStation');

// AWS Configuration
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();
const BUCKET_NAME = 'goodfoot-ems-bucket';

// Multer configuration
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 5 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG and PNG are allowed!'), false);
    }
  },
});

exports.uploadImage = upload.single('liveStationImage');

// Upload image to S3
const uploadToS3 = async (fileBuffer, fileName) => {
  const params = {
    Bucket: BUCKET_NAME,
    Key: `liveStation/${fileName}`,
    Body: fileBuffer,
    ContentType: 'image/jpeg',
  };
  return s3.upload(params).promise();
};

// Delete image from S3
const deleteFromS3 = async (fileKey) => {
  const params = {
    Bucket: BUCKET_NAME,
    Key: fileKey,
  };
  return s3.deleteObject(params).promise();
};

// Create a new LiveStation
// ... (previous code remains the same)
exports.createLiveStation = async (req, res) => {
  try {
    let { userName, stationName, nodes, edges, viewport } = req.body;

    // parse JSON if multipart/form-data
    if (typeof nodes === 'string')    nodes    = JSON.parse(nodes);
    if (typeof edges === 'string')    edges    = JSON.parse(edges);
    if (typeof viewport === 'string') viewport = JSON.parse(viewport);

    if (!stationName || !stationName.trim()) {
      return res.status(400).json({ message: 'Station name cannot be empty' });
    }
    const trimmedStationName = stationName.trim();

    // handle optional image
    let liveStationImage = null;
    if (req.file) {
      const fileName = `${Date.now()}-${req.file.originalname}`;
      const s3Resp = await uploadToS3(req.file.buffer, fileName);
      liveStationImage = s3Resp.Location;
    }

    const newLiveStation = new LiveStation({
      userName,
      stationName: trimmedStationName,
      liveStationImage,
      nodes,
      edges,
      viewport,                   // ← now saved too
    });

    const saved = await newLiveStation.save();
    res.status(201).json({
      message: 'Live Station created successfully',
      data: saved,
    });
  } catch (error) {
    console.error('Error creating Live Station:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
// ... (rest of the code remains the same)

// Get LiveStation by userName and stationName
exports.getLiveStationByUserName = async (req, res) => {
  try {
    const { userName, stationName } = req.params;
    const liveStation = await LiveStation.findOne({ userName, stationName });
    if (!liveStation) {
      return res.status(404).json({ message: 'Live Station not found' });
    }
    res.status(200).json({ message: 'Live Station retrieved successfully', data: liveStation });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Edit LiveStation
exports.editLiveStation = async (req, res) => {
  try {
    const { userName, stationName } = req.params;
    let { nodes, edges, viewport, stationName: newStationName } = req.body;

    // parse JSON strings
    if (typeof nodes === 'string')    nodes    = JSON.parse(nodes);
    if (typeof edges === 'string')    edges    = JSON.parse(edges);
    if (typeof viewport === 'string') viewport = JSON.parse(viewport);

    const liveStation = await LiveStation.findOne({ userName, stationName });
    if (!liveStation) {
      return res.status(404).json({ message: 'Live Station not found' });
    }

    // replace image if new file
    if (req.file) {
      if (liveStation.liveStationImage) {
        const oldKey = liveStation.liveStationImage.split('.amazonaws.com/')[1];
        await deleteFromS3(oldKey);
      }
      const fileName = `${Date.now()}-${req.file.originalname}`;
      const s3Resp = await uploadToS3(req.file.buffer, fileName);
      liveStation.liveStationImage = s3Resp.Location;
    }

    // update nodes/edges/viewport
    if (nodes)    liveStation.nodes    = nodes;
    if (edges)    liveStation.edges    = edges;
    if (viewport) liveStation.viewport = viewport;

    // rename station
    if (newStationName && newStationName.trim()) {
      liveStation.stationName = newStationName.trim();
    }

    const updated = await liveStation.save();
    res.status(200).json({
      message: 'Live Station updated successfully',
      data: updated,
    });
  } catch (error) {
    console.error('Error editing Live Station:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete LiveStation by userName and stationName
exports.deleteLiveStationByUserName = async (req, res) => {
  try {
    const { userName, stationName } = req.params;
    const liveStation = await LiveStation.findOne({ userName, stationName });
    if (!liveStation) {
      return res.status(404).json({ message: 'Live Station not found' });
    }

    await LiveStation.deleteOne({ userName, stationName });
    res.status(200).json({ message: 'Live Station deleted successfully' });
  } catch (error) {
    console.error('Error deleting Live Station:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete all images from S3
exports.deleteAllImages = async (req, res) => {
  try {
    const listParams = {
      Bucket: BUCKET_NAME,
      Prefix: 'liveStation/',
    };

    const listedObjects = await s3.listObjectsV2(listParams).promise();

    if (listedObjects.Contents.length === 0) {
      return res.status(404).json({ message: 'No images found' });
    }

    const deleteParams = {
      Bucket: BUCKET_NAME,
      Delete: { Objects: listedObjects.Contents.map(({ Key }) => ({ Key })) },
    };

    await s3.deleteObjects(deleteParams).promise();

    res.status(200).json({ message: 'All images deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
// Get all LiveStations by userName
exports.getLiveStationsByUserName = async (req, res) => {
  try {
    const { userName } = req.params;
    const liveStations = await LiveStation.find({ userName });
    if (!liveStations || liveStations.length === 0) {
      return res.status(404).json({ message: 'No Live Stations found for the user.' });
    }
    res.status(200).json({ message: 'Live Stations retrieved successfully', data: liveStations });
  } catch (error) {
    console.error('Error retrieving Live Stations:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
