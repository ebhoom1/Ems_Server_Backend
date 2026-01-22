// controllers/treatedWaterClarityController.js
const TreatedWaterClarityReport = require("../models/TreatedWaterClarityReport");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { S3Client } = require("@aws-sdk/client-s3");

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// helper: extract object key from url
const getKeyFromUrl = (url) => {
  try {
    const u = new URL(url);
    // pathname starts with /
    return decodeURIComponent(u.pathname.replace(/^\/+/, ""));
  } catch {
    return null;
  }
};

// GET /api/treated-water-clarity/:userId/:year/:month
const getTreatedWaterClarityReport = async (req, res) => {
  try {
    const { userId, year, month } = req.params;

    const report = await TreatedWaterClarityReport.findOne({
      userId,
      year: Number(year),
      month: Number(month),
    });

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    res.json(report);
  } catch (err) {
    console.error("Error fetching treated water clarity report:", err);
    res.status(500).json({ message: "Failed to fetch report" });
  }
};

// POST /api/treated-water-clarity/upload/:userId/:year/:month/:day
// Multer-S3 will already have stored files on S3; here we just save URLs
// const uploadTreatedWaterPhotos = async (req, res) => {
//   try {
//     const { userId, year, month, day } = req.params;
//     const yearNum = Number(year);
//     const monthNum = Number(month);
//     const dayNum = Number(day);

//     const files = req.files || [];
//     if (!files.length) {
//       return res.status(400).json({ success: false, message: "No files uploaded" });
//     }

//     const photoUrls = files.map((f) => f.location);

//     let report = await TreatedWaterClarityReport.findOne({
//       userId,
//       year: yearNum,
//       month: monthNum,
//     });

//     if (!report) {
//       report = new TreatedWaterClarityReport({
//         userId,
//         year: yearNum,
//         month: monthNum,
//         userName: req.body.userName || undefined,
//         siteName: req.body.siteName || undefined,
//         entries: [],
//       });
//     } else {
//       // Update optional meta if provided
//       if (req.body.userName) report.userName = req.body.userName;
//       if (req.body.siteName) report.siteName = req.body.siteName;
//     }

//     const idx = report.entries.findIndex((e) => e.date === dayNum);
//     if (idx === -1) {
//       report.entries.push({
//         date: dayNum,
//         photos: photoUrls,
//       });
//     } else {
//       report.entries[idx].photos = [
//         ...(report.entries[idx].photos || []),
//         ...photoUrls,
//       ];
//     }

//     await report.save();

//     const updatedEntry = report.entries.find((e) => e.date === dayNum);

//     res.status(200).json({
//       success: true,
//       message: "Photos uploaded successfully",
//       entry: updatedEntry,
//     });
//   } catch (err) {
//     console.error("Error uploading treated water clarity photos:", err);
//     res.status(500).json({ success: false, message: "Upload failed" });
//   }
// };

const uploadTreatedWaterPhotos = async (req, res) => {
  try {
    const { userId, year, month, day } = req.params;
    const yearNum = Number(year);
    const monthNum = Number(month);
    const dayNum = Number(day);

    const files = req.files || [];
    const { comment } = req.body; // Get the comment from the body

    if (!files.length) {
      return res.status(400).json({ success: false, message: "No files uploaded" });
    }

    const photoUrls = files.map((f) => f.location);

    let report = await TreatedWaterClarityReport.findOne({
      userId,
      year: yearNum,
      month: monthNum,
    });

    if (!report) {
      report = new TreatedWaterClarityReport({
        userId,
        year: yearNum,
        month: monthNum,
        userName: req.body.userName || undefined,
        siteName: req.body.siteName || undefined,
        entries: [],
      });
    } else {
      if (req.body.userName) report.userName = req.body.userName;
      if (req.body.siteName) report.siteName = req.body.siteName;
    }

    const idx = report.entries.findIndex((e) => e.date === dayNum);
    if (idx === -1) {
      report.entries.push({
        date: dayNum,
        photos: photoUrls,
        comment: comment || "", // Add comment to the new entry
      });
    } else {
      report.entries[idx].photos = [
        ...(report.entries[idx].photos || []),
        ...photoUrls,
      ];
      report.entries[idx].comment = comment || ""; // Update comment
    }

    await report.save();

    const updatedEntry = report.entries.find((e) => e.date === dayNum);

    res.status(200).json({
      success: true,
      message: "Photos and comment uploaded successfully",
      entry: updatedEntry,
    });
  } catch (err) {
    console.error("Error uploading treated water clarity photos:", err);
    res.status(500).json({ success: false, message: "Upload failed" });
  }
};


// DELETE /api/treated-water-clarity/photo/:userId/:year/:month/:day
const deleteTreatedWaterPhoto = async (req, res) => {
  try {
    const { userId, year, month, day } = req.params;
    const { photoUrl } = req.body;

    if (!photoUrl) {
      return res
        .status(400)
        .json({ success: false, message: "photoUrl is required" });
    }

    const yearNum = Number(year);
    const monthNum = Number(month);
    const dayNum = Number(day);

    const report = await TreatedWaterClarityReport.findOne({
      userId,
      year: yearNum,
      month: monthNum,
    });

    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    const entry = report.entries.find((e) => e.date === dayNum);
    if (!entry) {
      return res
        .status(404)
        .json({ success: false, message: "Entry for that day not found" });
    }

    const beforeLen = (entry.photos || []).length;
    entry.photos = (entry.photos || []).filter((p) => p !== photoUrl);

    if (entry.photos.length === beforeLen) {
      return res
        .status(404)
        .json({ success: false, message: "Photo not found in entry" });
    }

    await report.save();
    const updatedEntry = report.entries.find((e) => e.date === dayNum);

    return res.json({
      success: true,
      message: "Photo deleted successfully",
      entry: updatedEntry,
    });
  } catch (err) {
    console.error("Error deleting treated water photo:", err);
    res.status(500).json({ success: false, message: "Delete failed" });
  }
};

// POST /api/treated-water-clarity/signed-urls
const getSignedUrls = async (req, res) => {
  try {
    const { urls = [], expiresIn = 600 } = req.body;
    if (!Array.isArray(urls) || !urls.length) {
      return res.status(400).json({ message: "urls array required" });
    }

    const signedMap = {};

    for (const originalUrl of urls) {
      const key = getKeyFromUrl(originalUrl);
      if (!key) continue;

      const command = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME_ || "goodfoot-ems-bucket",
        Key: key,
      });

      const signed = await getSignedUrl(s3, command, {
        expiresIn: Math.min(Number(expiresIn) || 600, 3600),
      });

      signedMap[originalUrl] = signed;
    }

    return res.json({ signedMap });
  } catch (err) {
    console.error("signed-urls error:", err);
    return res.status(500).json({ message: "Failed to create signed urls" });
  }
};

module.exports = {
  getTreatedWaterClarityReport,
  uploadTreatedWaterPhotos,
  deleteTreatedWaterPhoto,
  getSignedUrls,
};
