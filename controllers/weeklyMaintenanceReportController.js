// FILE: controllers/weeklyMaintenanceReportController.js

const WeeklyMaintenanceReport = require("../models/WeeklyMaintenanceReport");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// GET /api/weekly-maintenance/:userId/:weekStart
exports.getReport = async (req, res) => {
  try {
    const { userId, weekStart } = req.params;

    const report = await WeeklyMaintenanceReport.findOne({ userId, weekStart });

    if (!report) {
      return res.json({
        userId,
        weekStart,
        entries: [],
      });
    }

    res.json(report);
  } catch (err) {
    console.error("Error in getReport:", err);
    res.status(500).json({ message: "Failed to fetch weekly report" });
  }
};

// POST /api/weekly-maintenance
// Body: { userId, weekStart, entries:[{ date:"yyyy-mm-dd", comment }] }
exports.saveOrUpdateReport = async (req, res) => {
  try {
    const { userId, weekStart, entries } = req.body;

    if (!userId || !weekStart) {
      return res.status(400).json({ message: "userId and weekStart are required" });
    }

    let report = await WeeklyMaintenanceReport.findOne({ userId, weekStart });

    if (!report) {
      report = new WeeklyMaintenanceReport({
        userId,
        weekStart,
        entries: (entries || []).map((e) => ({
          date: e.date,
          comment: e.comment || "",
          photos: [],
        })),
      });
    } else {
      // update comment only, don't erase photos
      const byDate = new Map((report.entries || []).map((e) => [e.date, e]));
      (entries || []).forEach((e) => {
        const existing = byDate.get(e.date);
        if (existing) {
          existing.comment = e.comment || "";
        } else {
          report.entries.push({
            date: e.date,
            comment: e.comment || "",
            photos: [],
          });
        }
      });
    }

    await report.save();
    res.json(report);
  } catch (err) {
    console.error("Error in saveOrUpdateReport:", err);
    res.status(500).json({ message: "Failed to save weekly report" });
  }
};

// POST /api/weekly-maintenance/upload/:userId/:weekStart/:dateISO
// multer already uploaded to S3
exports.addPhotosToDate = async (req, res) => {
  try {
    const { userId, weekStart, dateISO } = req.params;

    const photoUrls = (req.files || []).map((f) => f.location);
    if (!photoUrls.length) return res.status(400).json({ message: "No files received" });

    const { photoType } = req.body;
    const type =
      photoType === "EPM"
        ? "EPM"
        : photoType === "GENERAL"
        ? "GENERAL"
        : "MPM";

    let report = await WeeklyMaintenanceReport.findOne({ userId, weekStart });
    if (!report) {
      report = new WeeklyMaintenanceReport({ userId, weekStart, entries: [] });
    }

    let entry = (report.entries || []).find((e) => e.date === dateISO);
    if (!entry) {
      entry = { date: dateISO, comment: "", photos: [] };
      report.entries.push(entry);
    }

    entry.photos = entry.photos || [];
    entry.photos = entry.photos || [];
entry.photos.push(...photoUrls);

    await report.save();

    return res.json({
      success: true,
      message: "Photos added",
      entry,
    });
  } catch (err) {
    console.error("Error in addPhotosToDate:", err);
    res.status(500).json({ message: "Failed to attach photos" });
  }
};

// DELETE /api/weekly-maintenance/photo/:userId/:weekStart/:dateISO
// Body: { photoUrl }
exports.deletePhotoFromDate = async (req, res) => {
  try {
    const { userId, weekStart, dateISO } = req.params;
    const { photoUrl } = req.body;

    if (!photoUrl) {
      return res.status(400).json({ success: false, message: "photoUrl is required" });
    }

    const report = await WeeklyMaintenanceReport.findOne({ userId, weekStart });
    if (!report) return res.status(404).json({ success: false, message: "Report not found" });

    const entry = (report.entries || []).find((e) => e.date === dateISO);
    if (!entry) return res.status(404).json({ success: false, message: "Entry not found" });

    const beforeLen = (entry.photos || []).length;

    entry.photos = (entry.photos || []).filter((p) => p !== photoUrl);

    if (entry.photos.length === beforeLen) {
      return res.status(404).json({ success: false, message: "Photo not found in entry" });
    }

    await report.save();

    const updatedEntry = (report.entries || []).find((e) => e.date === dateISO);

    return res.json({
      success: true,
      message: "Photo deleted successfully",
      entry: updatedEntry,
    });
  } catch (err) {
    console.error("Error in deletePhotoFromDate:", err);
    res.status(500).json({ success: false, message: "Failed to delete photo" });
  }
};

// POST /api/weekly-maintenance/signed-urls
// Body: { urls:[], expiresIn }
exports.getSignedUrls = async (req, res) => {
  try {
    const { urls = [], expiresIn = 300 } = req.body || {};
    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ message: "urls array is required" });
    }

    const BUCKET_NAME = process.env.AWS_S3_BUCKET || "goodfoot-ems-bucket";
    const REGION = process.env.AWS_REGION;
    if (!REGION) return res.status(500).json({ message: "AWS_REGION missing in .env" });

    const s3 = new S3Client({
      region: REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    const toKey = (u) => {
      if (!u || typeof u !== "string") return null;

      if (!u.startsWith("http")) {
        return decodeURIComponent(u.replace(/^\/+/, ""));
      }

      try {
        const parsed = new URL(u);
        const pathname = decodeURIComponent(parsed.pathname || "");
        const parts = pathname.split("/").filter(Boolean);

        if (parts.length && parts[0] === BUCKET_NAME) parts.shift();

        return parts.join("/") || null;
      } catch {
        return null;
      }
    };

    const signedMap = {};

    await Promise.all(
      urls.map(async (u) => {
        try {
          const key = toKey(u);
          if (!key) {
            signedMap[u] = null;
            return;
          }

          const cmd = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });
          const signedUrl = await getSignedUrl(s3, cmd, { expiresIn: Number(expiresIn) || 300 });
          signedMap[u] = signedUrl;
        } catch (err) {
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
