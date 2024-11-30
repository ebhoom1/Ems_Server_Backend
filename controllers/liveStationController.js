const LiveStation = require('../models/LiveStation');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads/liveStation'); // Directory to save uploaded images
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG and PNG are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 5 }, // Limit file size to 5MB
  fileFilter: fileFilter,
});

// Middleware to handle image upload
exports.uploadImage = upload.single('liveStationImage');

// Controller function to handle Live Station creation
exports.createLiveStation = async (req, res) => {
  try {
    const { userName } = req.body;
    if (!req.file) {
      return res.status(400).json({ message: 'Image is required' });
    }

    const newLiveStation = new LiveStation({
      userName,
      liveStationImage: req.file.path, // Save the image path in the database
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
    const { userName } = req.params; // Extract userName from request params

    // Find the live station by userName
    const liveStation = await LiveStation.findOne({ userName });

    // If no data found, return a 404 error
    if (!liveStation) {
      return res.status(404).json({ message: 'Live Station not found' });
    }

    // Return the live station data
    res.status(200).json({
      message: 'Live Station retrieved successfully',
      data: liveStation,
    });
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

    // Delete the old image if it exists
    if (liveStation.liveStationImage && fs.existsSync(liveStation.liveStationImage)) {
      fs.unlinkSync(liveStation.liveStationImage); // Delete old image file
    }

    // Update the image path in the database
    liveStation.liveStationImage = req.file.path;
    const updatedLiveStation = await liveStation.save();

    res.status(200).json({
      message: 'Live Station image updated successfully',
      data: updatedLiveStation,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Controller function to delete a Live Station by userName
exports.deleteLiveStationByUserName = async (req, res) => {
    try {
      const { userName } = req.params; // Extract userName from request params
  
      // Find the live station by userName
      const liveStation = await LiveStation.findOne({ userName });
  
      if (!liveStation) {
        return res.status(404).json({ message: 'Live Station not found' });
      }
  
      // Delete the associated image file if it exists
      if (liveStation.liveStationImage && fs.existsSync(liveStation.liveStationImage)) {
        fs.unlinkSync(liveStation.liveStationImage); // Delete the image file
      }
  
      // Delete the live station record from the database
      await LiveStation.deleteOne({ userName });
  
      res.status(200).json({ message: 'Live Station deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  };



  exports.deleteAllImages = (req, res) => {
    const directoryPath = path.join(__dirname, '../uploads/liveStation');
  
    // Check if directory exists
    if (!fs.existsSync(directoryPath)) {
      return res.status(404).json({ message: 'Directory not found' });
    }
  
    try {
      // Read all files in the directory
      const files = fs.readdirSync(directoryPath);
  
      // Iterate through the files and delete each
      files.forEach((file) => {
        const filePath = path.join(directoryPath, file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
  
      res.status(200).json({ message: 'All images deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  };
