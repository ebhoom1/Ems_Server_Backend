const AWS = require('aws-sdk');
const multer = require('multer');
const LiveStation = require('../models/LiveStation');

// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();
const BUCKET_NAME = 'ems-ebhoom-bucket' ; // Replace with your bucket name

// Multer configuration for in-memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 5 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG and PNG are allowed!'), false);
    }
  },
});

// Middleware for image upload
exports.uploadImage = upload.single('liveStationImage');

// Upload image to S3
const uploadToS3 = async (fileBuffer, fileName) => {
  const params = {
    Bucket: BUCKET_NAME,
    Key: `liveStation/${fileName}`,
    Body: fileBuffer,
    ContentType: 'image/jpeg', // Adjust as needed
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

// Controller function to create a LiveStation
exports.createLiveStation = async (req, res) => {
  try {
    const { userName } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'Image is required' });
    }

    // Check if the userName already exists in the database
    const existingLiveStation = await LiveStation.findOne({ userName });
    if (existingLiveStation) {
      return res.status(400).json({
        message: 'This userName already exists. Please use the edit method to update it or delete it and create a new one.',
      });
    }

    // Upload the image to S3
    const fileName = `${Date.now()}-${req.file.originalname}`;
    const s3Response = await uploadToS3(req.file.buffer, fileName);

    // Create a new LiveStation
    const newLiveStation = new LiveStation({
      userName,
      liveStationImage: s3Response.Location, // Save the S3 file URL
    });

    const savedLiveStation = await newLiveStation.save();
    res.status(201).json({ message: 'Live Station created successfully', data: savedLiveStation });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Controller function to get data by userName
exports.getLiveStationByUserName = async (req, res) => {
  try {
    const { userName } = req.params;

    const liveStation = await LiveStation.findOne({ userName });

    if (!liveStation) {
      return res.status(404).json({ message: 'Live Station not found' });
    }

    res.status(200).json({ message: 'Live Station retrieved successfully', data: liveStation });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Controller function to edit the image by userName
exports.editLiveStationImage = async (req, res) => {
  try {
    const { userName } = req.params;

    // Find the live station by userName
    const liveStation = await LiveStation.findOne({ userName });

    if (!liveStation) {
      return res.status(404).json({ message: 'Live Station not found' });
    }

    // Handle existing image deletion from S3
    if (liveStation.liveStationImage) {
      const oldKey = liveStation.liveStationImage.includes('.amazonaws.com')
        ? liveStation.liveStationImage.split('.amazonaws.com/')[1]
        : null;

      if (oldKey) {
        console.log('Deleting old image from S3 with Key:', oldKey);
        await deleteFromS3(oldKey);
      } else {
        console.warn('Invalid or missing S3 URL. Skipping delete operation.');
      }
    }

    // Upload the new image to S3
    const fileName = `${Date.now()}-${req.file.originalname}`;
    const s3Response = await uploadToS3(req.file.buffer, fileName);

    // Update the database with the new image URL
    liveStation.liveStationImage = s3Response.Location;
    const updatedLiveStation = await liveStation.save();

    res.status(200).json({
      message: 'Live Station image updated successfully',
      data: updatedLiveStation,
    });
  } catch (error) {
    console.error('Error updating Live Station image:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Controller function to delete a LiveStation by userName
exports.deleteLiveStationByUserName = async (req, res) => {
  try {
    const { userName } = req.params;

    const liveStation = await LiveStation.findOne({ userName });

    if (!liveStation) {
      return res.status(404).json({ message: 'Live Station not found' });
    }

    // Delete the image from S3
    if (liveStation.liveStationImage) {
      const fileKey = liveStation.liveStationImage.split('.amazonaws.com/')[1];
      await deleteFromS3(fileKey);
    }

    await LiveStation.deleteOne({ userName });

    res.status(200).json({ message: 'Live Station deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Controller function to delete all images from S3
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
