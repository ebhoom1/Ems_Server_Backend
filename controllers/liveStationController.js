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
const BUCKET_NAME = 'ems-ebhoom-bucket';

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
    const { userName, stationName, nodes, edges } = req.body;

    // Basic validation
    if (!stationName || !stationName.trim()) {
      return res.status(400).json({
        message: 'Station name cannot be empty',
      });
    }

    const trimmedStationName = stationName.trim();

    let liveStationImage = null;
    if (req.file) {
      const fileName = `${Date.now()}-${req.file.originalname}`;
      const s3Response = await uploadToS3(req.file.buffer, fileName);
      liveStationImage = s3Response.Location;
    }

    const newLiveStation = new LiveStation({
      userName,
      stationName: trimmedStationName,
      liveStationImage,
      nodes,
      edges,
    });

    const savedLiveStation = await newLiveStation.save();
    res.status(201).json({ 
      message: 'Live Station created successfully', 
      data: savedLiveStation 
    });
  } catch (error) {
    console.error('Error creating Live Station:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message 
    });
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
    const { userName, stationName } = req.params; // stationName here is the original station name
    const { nodes, edges, stationName: newStationName } = req.body;

    const liveStation = await LiveStation.findOne({ userName, stationName });
    if (!liveStation) {
      return res.status(404).json({ message: 'Live Station not found' });
    }

    // Update image if provided
    if (req.file) {
      if (liveStation.liveStationImage) {
        const oldKey = liveStation.liveStationImage.split('.amazonaws.com/')[1];
        await deleteFromS3(oldKey);
      }
      const fileName = `${Date.now()}-${req.file.originalname}`;
      const s3Response = await uploadToS3(req.file.buffer, fileName);
      liveStation.liveStationImage = s3Response.Location;
    }

    // Update nodes and edges if provided
    if (nodes) {
      liveStation.nodes = typeof nodes === 'string' ? JSON.parse(nodes) : nodes;
    }
    if (edges) {
      liveStation.edges = typeof edges === 'string' ? JSON.parse(edges) : edges;
    }

    // Update stationName if provided (allows editing the station name)
    if (newStationName) {
      liveStation.stationName = newStationName;
    }

    const updatedLiveStation = await liveStation.save();
    res.status(200).json({ message: 'Live Station updated successfully', data: updatedLiveStation });
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
