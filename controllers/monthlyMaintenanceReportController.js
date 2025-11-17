// controllers/monthlyReportController.js
const MonthlyMaintenanceReport = require('../models/MonthlyMaintenanceReport');

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

    let report = await MonthlyMaintenanceReport.findOne({ userId, year: y, month: m });

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
    entry.photos.push(...photoUrls);

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
    entry.photos = (entry.photos || []).filter((p) => p !== photoUrl);

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
