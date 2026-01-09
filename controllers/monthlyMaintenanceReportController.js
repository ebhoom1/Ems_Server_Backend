// controllers/monthlyReportController.js
const MonthlyMaintenanceReport = require('../models/MonthlyMaintenanceReport');
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// GET /api/monthly-report/:userId/:year/:month
exports.getReport = async (req, res) => {
  try {
    const { userId, year, month } = req.params;
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);

    const report = await MonthlyMaintenanceReport.findOne({ userId, year: y, month: m });

    if (!report) {
      return res.json({
        userId,
        year: y,
        month: m,
        entries: [],
      });
    }

    res.json(report);
  } catch (err) {
    console.error('Error in getReport:', err);
    res.status(500).json({ message: 'Failed to fetch report' });
  }
};

// POST /api/monthly-report
// Body: { userId, year, month, entries:[{ date, comment }] }
exports.saveOrUpdateReport = async (req, res) => {
  try {
    const { userId, year, month, entries } = req.body;

    if (!userId || !year || !month) {
      return res
        .status(400)
        .json({ message: 'userId, year and month are required' });
    }

    const y = parseInt(year, 10);
    const m = parseInt(month, 10);

    let report = await MonthlyMaintenanceReport.findOne({ userId, year: y, month: m });

    if (!report) {
      // Create new document
      report = new MonthlyMaintenanceReport({
        userId,
        year: y,
        month: m,
        entries: (entries || []).map((e) => ({
          date: e.date,
          comment: e.comment || '',
          photos: [],
        })),
      });
    } else {
      // Update comments only, don't erase photos
      const byDate = new Map(report.entries.map((e) => [e.date, e]));
      (entries || []).forEach((e) => {
        const d = parseInt(e.date, 10);
        const existing = byDate.get(d);
        if (existing) {
          existing.comment = e.comment || '';
        } else {
          report.entries.push({
            date: d,
            comment: e.comment || '',
            photos: [],
          });
        }
      });
    }

    await report.save();
    res.json(report);
  } catch (err) {
    console.error('Error in saveOrUpdateReport:', err);
    res.status(500).json({ message: 'Failed to save report' });
  }
};

// Called after S3 upload middleware
// POST /api/monthly-report/upload/:userId/:year/:month/:day
// POST /api/monthly-report/upload/:userId/:year/:month/:day
exports.addPhotosToDate = async (req, res) => {
  try {
    const { userId, year, month, day } = req.params;
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    const d = parseInt(day, 10);

    const photoUrls = (req.files || []).map((f) => f.location);

    if (!photoUrls.length) {
      return res.status(400).json({ message: 'No files received' });
    }

    // 👇 NEW: read photo type from body (MPM / EPM)
    const { photoType } = req.body;
    const type = photoType === 'EPM' ? 'EPM' : photoType === 'GENERAL' ? 'GENERAL'
      : 'MPM';
    let report = await MonthlyMaintenanceReport.findOne({
      userId,
      year: y,
      month: m,
    });

    if (!report) {
      report = new MonthlyMaintenanceReport({
        userId,
        year: y,
        month: m,
        entries: [],
      });
    }

    let entry = report.entries.find((e) => e.date === d);
    if (!entry) {
      entry = {
        date: d,
        comment: '',
        photos: [],
      };
      report.entries.push(entry);
    }

    entry.photos = entry.photos || [];

    // 👇 NEW: push objects with url + type
    const photoObjects = photoUrls.map((url) => ({ url, type }));
    entry.photos.push(...photoObjects);

    await report.save();

    res.json({
      success: true,
      message: 'Photos added',
      entry,
    });
  } catch (err) {
    console.error('Error in addPhotosToDate:', err);
    res.status(500).json({ message: 'Failed to attach photos' });
  }
};

// DELETE /api/monthly-maintenance/photo/:userId/:year/:month/:day
// Body: { photoUrl }
// DELETE /api/monthly-maintenance/photo/:userId/:year/:month/:day
exports.deletePhotoFromDate = async (req, res) => {
  try {
    const { userId, year, month, day } = req.params;
    const { photoUrl } = req.body;

    if (!photoUrl) {
      return res
        .status(400)
        .json({ success: false, message: 'photoUrl is required' });
    }

    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    const d = parseInt(day, 10);

    const report = await MonthlyMaintenanceReport.findOne({
      userId,
      year: y,
      month: m,
    });

    if (!report) {
      return res
        .status(404)
        .json({ success: false, message: 'Report not found' });
    }

    const entry = report.entries.find((e) => e.date === d);
    if (!entry) {
      return res
        .status(404)
        .json({ success: false, message: 'Entry for that day not found' });
    }

    const beforeLen = (entry.photos || []).length;

    // 👇 handle both old string style and new { url, type } style
    entry.photos = (entry.photos || []).filter((p) => {
      if (typeof p === 'string') return p !== photoUrl;
      return p.url !== photoUrl;
    });

    if (entry.photos.length === beforeLen) {
      return res
        .status(404)
        .json({ success: false, message: 'Photo not found in entry' });
    }

    await report.save();

    const updatedEntry = report.entries.find((e) => e.date === d);

    return res.json({
      success: true,
      message: 'Photo deleted successfully',
      entry: updatedEntry,
    });
  } catch (err) {
    console.error('Error in deletePhotoFromDate:', err);
    res
      .status(500)
      .json({ success: false, message: 'Failed to delete photo' });
  }
};
exports.getSignedUrls = async (req, res) => {
  try {
    const { urls = [], expiresIn = 300 } = req.body || {};

    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ message: "urls array is required" });
    }

    const BUCKET_NAME = process.env.AWS_S3_BUCKET || "ems-ebhoom-bucket";
    const REGION = process.env.AWS_REGION;

    if (!REGION) {
      return res.status(500).json({ message: "AWS_REGION missing in .env" });
    }

    // ✅ Create S3 client (uses your .env IAM creds)
    const s3 = new S3Client({
      region: REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    // ✅ Convert incoming value into S3 object Key
    // Supports:
    // 1) Full URL: https://bucket.s3.region.amazonaws.com/monthlyMaintenance/...
    // 2) Full URL: https://s3.region.amazonaws.com/bucket/monthlyMaintenance/...
    // 3) Raw key: monthlyMaintenance/.../file.jpg
    const toKey = (u) => {
      if (!u || typeof u !== "string") return null;

      // If frontend sends S3 key directly
      if (!u.startsWith("http")) {
        return decodeURIComponent(u.replace(/^\/+/, ""));
      }

      try {
        const parsed = new URL(u);
        const pathname = decodeURIComponent(parsed.pathname || "");

        // Virtual-hosted style:
        //   /monthlyMaintenance/... => key is pathname without leading "/"
        // Path-style:
        //   /bucket/monthlyMaintenance/... => remove "/bucket/" first
        const parts = pathname.split("/").filter(Boolean);

        // If first part is bucket name, remove it
        if (parts.length && parts[0] === BUCKET_NAME) {
          parts.shift();
        }

        return parts.join("/") || null;
      } catch (e) {
        return null;
      }
    };

    // Collect unique keys
    const signedMap = {};

    await Promise.all(
      urls.map(async (u) => {
        try {
          const key = toKey(u);
          if (!key) {
            signedMap[u] = null;
            return;
          }

          const cmd = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
          });

          const signedUrl = await getSignedUrl(s3, cmd, {
            expiresIn: Number(expiresIn) || 300,
          });

          signedMap[u] = signedUrl;
        } catch (err) {
          // ✅ Don’t fail whole request if one url fails
          console.error("Signed URL failed for:", u, err?.message);
          signedMap[u] = null;
        }
      })
    );

    return res.json({ success: true, signedMap });
  } catch (err) {
    console.error("getSignedUrls error:", err);
    return res.status(500).json({ message: "Failed to generate signed urls" });
  }
};