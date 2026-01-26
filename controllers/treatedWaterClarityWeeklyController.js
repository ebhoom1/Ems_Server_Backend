// controllers/treatedWaterClarityWeeklyController.js
const TreatedWaterClarityWeeklyReport = require("../models/TreatedWaterClarityWeeklyReport");
const { GetObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

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
    return decodeURIComponent(u.pathname.replace(/^\/+/, ""));
  } catch {
    return null;
  }
};

// helper: validate day belongs to week bucket
const weekRanges = (year, monthNum) => {
  // monthNum: 1..12
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  return [
    { week: 1, start: 1, end: 7 },
    { week: 2, start: 8, end: 14 },
    { week: 3, start: 15, end: 21 },
    { week: 4, start: 22, end: daysInMonth },
  ];
};

const isDayInWeek = (year, monthNum, weekNum, dayNum) => {
  const wr = weekRanges(year, monthNum).find((w) => w.week === weekNum);
  if (!wr) return false;
  return dayNum >= wr.start && dayNum <= wr.end;
};

// GET /api/treated-water-clarity-weekly/:userId/:year/:month/:week
const getTreatedWaterClarityWeeklyReport = async (req, res) => {
  try {
    const { userId, year, month, week } = req.params;

    const report = await TreatedWaterClarityWeeklyReport.findOne({
      userId,
      year: Number(year),
      month: Number(month),
      week: Number(week),
    });

    if (!report) return res.status(404).json({ message: "Report not found" });

    res.json(report);
  } catch (err) {
    console.error("Error fetching treated water clarity weekly report:", err);
    res.status(500).json({ message: "Failed to fetch report" });
  }
};

// POST /api/treated-water-clarity-weekly/upload/:userId/:year/:month/:week/:day
// NOTE: supports BOTH cases:
//  1) photos + comment
//  2) comment-only update (no files) ✅
const uploadWeeklyTreatedWaterPhotos = async (req, res) => {
  try {
    const { userId, year, month, week, day } = req.params;
    const yearNum = Number(year);
    const monthNum = Number(month);
    const weekNum = Number(week);
    const dayNum = Number(day);

    if (!isDayInWeek(yearNum, monthNum, weekNum, dayNum)) {
      return res.status(400).json({
        success: false,
        message: `Day ${dayNum} does not belong to week ${weekNum} for ${monthNum}/${yearNum}`,
      });
    }

    const files = req.files || [];
    const comment = (req.body?.comment ?? "").toString();

    // allow comment-only
    const hasPhotos = files.length > 0;
    const hasComment = comment.trim().length > 0;

    if (!hasPhotos && !hasComment) {
      return res.status(400).json({
        success: false,
        message: "No files uploaded and comment is empty",
      });
    }

    const photoUrls = hasPhotos ? files.map((f) => f.location) : [];

    let report = await TreatedWaterClarityWeeklyReport.findOne({
      userId,
      year: yearNum,
      month: monthNum,
      week: weekNum,
    });

    if (!report) {
      report = new TreatedWaterClarityWeeklyReport({
        userId,
        year: yearNum,
        month: monthNum,
        week: weekNum,
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
        comment: comment || "",
      });
    } else {
      // merge photos if any
      if (photoUrls.length) {
        report.entries[idx].photos = [
          ...(report.entries[idx].photos || []),
          ...photoUrls,
        ];
      }
      // update comment even if no photos
      report.entries[idx].comment = comment || report.entries[idx].comment || "";
    }

    await report.save();

    const updatedEntry = report.entries.find((e) => e.date === dayNum);

    return res.status(200).json({
      success: true,
      message: hasPhotos
        ? "Photos and comment saved successfully"
        : "Comment saved successfully",
      entry: updatedEntry,
    });
  } catch (err) {
    console.error("Error uploading weekly treated water clarity:", err);
    res.status(500).json({ success: false, message: "Upload failed" });
  }
};

// DELETE /api/treated-water-clarity-weekly/photo/:userId/:year/:month/:week/:day
const deleteWeeklyTreatedWaterPhoto = async (req, res) => {
  try {
    const { userId, year, month, week, day } = req.params;
    const { photoUrl } = req.body;

    if (!photoUrl) {
      return res.status(400).json({ success: false, message: "photoUrl is required" });
    }

    const yearNum = Number(year);
    const monthNum = Number(month);
    const weekNum = Number(week);
    const dayNum = Number(day);

    const report = await TreatedWaterClarityWeeklyReport.findOne({
      userId,
      year: yearNum,
      month: monthNum,
      week: weekNum,
    });

    if (!report) return res.status(404).json({ success: false, message: "Report not found" });

    const entry = report.entries.find((e) => e.date === dayNum);
    if (!entry) return res.status(404).json({ success: false, message: "Entry for that day not found" });

    const beforeLen = (entry.photos || []).length;
    entry.photos = (entry.photos || []).filter((p) => p !== photoUrl);

    if (entry.photos.length === beforeLen) {
      return res.status(404).json({ success: false, message: "Photo not found in entry" });
    }

    await report.save();
    const updatedEntry = report.entries.find((e) => e.date === dayNum);

    return res.json({
      success: true,
      message: "Photo deleted successfully",
      entry: updatedEntry,
    });
  } catch (err) {
    console.error("Error deleting weekly treated water photo:", err);
    res.status(500).json({ success: false, message: "Delete failed" });
  }
};

// POST /api/treated-water-clarity-weekly/signed-urls
const getWeeklySignedUrls = async (req, res) => {
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
    console.error("weekly signed-urls error:", err);
    return res.status(500).json({ message: "Failed to create signed urls" });
  }
};

module.exports = {
  getTreatedWaterClarityWeeklyReport,
  uploadWeeklyTreatedWaterPhotos,
  deleteWeeklyTreatedWaterPhoto,
  getWeeklySignedUrls,
};
