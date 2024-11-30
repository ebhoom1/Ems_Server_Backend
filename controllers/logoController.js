const AWS = require('aws-sdk');
const multer = require('multer');
const Logo = require('../models/Logo');

// AWS S3 Configuration
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();
const BUCKET_NAME = 'ems-ebhoom-bucket'; // Replace with your bucket name

// Multer Configuration
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
exports.uploadLogoImage = upload.single('logo');

// Upload to S3
const uploadToS3 = async (fileBuffer, fileName) => {
    const params = {
        Bucket: BUCKET_NAME,
        Key: `logo/${fileName}`,
        Body: fileBuffer,
        ContentType: 'image/jpeg',
    };
    return s3.upload(params).promise();
};

// Delete from S3
const deleteFromS3 = async (fileKey) => {
    const params = {
        Bucket: BUCKET_NAME,
        Key: fileKey,
    };
    return s3.deleteObject(params).promise();
};

// Create Logo
exports.createLogo = async (req, res) => {
    try {
        const { userName, adminType } = req.body;

        if (!req.file) {
            return res.status(400).json({ message: 'Logo image is required' });
        }

        const fileName = `${Date.now()}-${req.file.originalname}`;
        const s3Response = await uploadToS3(req.file.buffer, fileName);

        const newLogo = new Logo({
            userName,
            adminType,
            logoUrl: s3Response.Location,
        });

        const savedLogo = await newLogo.save();
        res.status(201).json({ message: 'Logo uploaded successfully', data: savedLogo });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Retrieve Logo
exports.getLogoByUserName = async (req, res) => {
    try {
        const { userName, adminType } = req.params;

        const logo = await Logo.findOne({ userName, adminType });
        if (!logo) {
            return res.status(404).json({ message: 'Logo not found for the given userName and adminType' });
        }

        res.status(200).json({ message: 'Logo retrieved successfully', data: logo });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};


// Update Logo
exports.updateLogo = async (req, res) => {
    try {
        const { userName } = req.params;

        const logo = await Logo.findOne({ userName });
        if (!logo) {
            return res.status(404).json({ message: 'Logo not found' });
        }

        if (logo.logoUrl) {
            const oldKey = logo.logoUrl.split('.amazonaws.com/')[1];
            await deleteFromS3(oldKey);
        }

        const fileName = `${Date.now()}-${req.file.originalname}`;
        const s3Response = await uploadToS3(req.file.buffer, fileName);

        logo.logoUrl = s3Response.Location;
        const updatedLogo = await logo.save();

        res.status(200).json({ message: 'Logo updated successfully', data: updatedLogo });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// Delete Logo
exports.deleteLogoByUserName = async (req, res) => {
    try {
        const { userName } = req.params;

        const logo = await Logo.findOne({ userName });
        if (!logo) {
            return res.status(404).json({ message: 'Logo not found' });
        }

        const fileKey = logo.logoUrl.split('.amazonaws.com/')[1];
        await deleteFromS3(fileKey);

        await Logo.deleteOne({ userName });
        res.status(200).json({ message: 'Logo deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
