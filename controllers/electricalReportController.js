// controllers/electricalReport.js
const { getReportsFromS3, saveReportsToS3, saveReportToS3 } = require('../S3Bucket/s3ElectricalReport');

// ✅ Create or update report (monthly unique per equipment)
exports.createReport = async (req, res) => {
  try {
    const { equipmentId, technician, equipment, responses } = req.body;
    const userName = (req.user && req.user.userName) || req.body.userName;

    if (!equipmentId || !technician?.name || !technician?.email || !equipment?.name || !responses || !userName) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const reports = await getReportsFromS3();

    // Determine month range
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const startOfMonth = new Date(y, m, 1);
    const endOfMonth = new Date(y, m + 1, 0, 23, 59, 59);

    // Check if report already exists for this equipment in current month
    let existing = reports.find(r =>
      r.equipmentId === equipmentId &&
      new Date(r.createdAt) >= startOfMonth &&
      new Date(r.createdAt) <= endOfMonth
    );

    if (existing) {
      // Update existing
      existing.technician = technician;
      existing.equipment = equipment;
      existing.responses = responses;
      existing.userName = userName;
      existing.updatedAt = new Date();
      await saveReportsToS3(reports);
      return res.status(200).json({ success: true, report: existing });
    } else {
      // Create new
      const newReport = {
        equipmentId,
        technician,
        equipment,
        responses,
        userName,
      };
      const saved = await saveReportToS3(newReport);
      return res.status(201).json({ success: true, report: saved });
    }
  } catch (err) {
    console.error("🔴 Error creating/updating ElectricalReport:", err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ✅ Get all reports
exports.getAllReports = async (req, res) => {
  try {
    const reports = await getReportsFromS3();
    res.json({ success: true, reports: reports.reverse() });
  } catch (err) {
    console.error('Error fetching reports:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ✅ Get report by equipmentId (latest)
exports.getReportByEquipment = async (req, res) => {
  try {
    const { equipmentId } = req.params;
    const reports = await getReportsFromS3();
    const report = reports.filter(r => r.equipmentId === equipmentId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    if (!report) return res.status(404).json({ success: false, message: 'Report not found for this equipment' });
    res.json({ success: true, report });
  } catch (err) {
    console.error('Error fetching report:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ✅ Get report by ID
exports.getReportById = async (req, res) => {
  try {
    const { id } = req.params;
    const reports = await getReportsFromS3();
    const report = reports.find(r => r._id === id);
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true, report });
  } catch (err) {
    console.error('Error fetching report by ID:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ✅ Delete report
exports.deleteReport = async (req, res) => {
  try {
    const { id } = req.params;
    let reports = await getReportsFromS3();
    const initialLength = reports.length;
    reports = reports.filter(r => r._id !== id);
    if (reports.length === initialLength) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }
    await saveReportsToS3(reports);
    res.json({ success: true, message: 'Report deleted' });
  } catch (err) {
    console.error('Error deleting report:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ✅ Get reports by month
exports.getReportsByMonth = async (req, res) => {
  try {
    const year = parseInt(req.params.year, 10);
    const month = parseInt(req.params.month, 10);
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ success: false, message: 'Invalid year or month' });
    }

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const reports = await getReportsFromS3();
    const filtered = reports.filter(r => {
      const d = new Date(r.createdAt);
      return d >= start && d < end;
    });

    res.json({ success: true, reports: filtered });
  } catch (err) {
    console.error('Error fetching reports by month:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ✅ Get reports by user + month
exports.getReportsByUserMonth = async (req, res) => {
  try {
    const { userName, year, month } = req.params;
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);

    if (isNaN(y) || isNaN(m) || m < 1 || m > 12) {
      return res.status(400).json({ success: false, message: 'Invalid year or month' });
    }

    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);

    const reports = await getReportsFromS3();
    const filtered = reports.filter(r =>
      r.userName === userName &&
      new Date(r.createdAt) >= start &&
      new Date(r.createdAt) < end
    );

    res.json({ success: true, reports: filtered });
  } catch (err) {
    console.error('Error fetching reports by user/month:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ✅ Check if report exists (equipment + month)
exports.reportExists = async (req, res) => {
  try {
    const { equipmentId } = req.params;
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({ success: false, message: "Year and month query parameters are required." });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const reports = await getReportsFromS3();
    const report = reports.find(r =>
      r.equipmentId === equipmentId &&
      new Date(r.createdAt) >= startDate &&
      new Date(r.createdAt) <= endDate
    );

    return res.json({ success: true, exists: !!report });
  } catch (err) {
    console.error("Error checking if report exists:", err);
    return res.status(500).json({ success: false, message: "Server error while checking report existence." });
  }
};

// ✅ Get report by equipment + month
exports.getReportByEquipmentAndMonth = async (req, res) => {
  try {
    const { equipmentId } = req.params;
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({ success: false, message: "Year and month query parameters are required." });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const reports = await getReportsFromS3();
    const report = reports.find(r =>
      r.equipmentId === equipmentId &&
      new Date(r.createdAt) >= startDate &&
      new Date(r.createdAt) <= endDate
    );

    if (!report) return res.status(404).json({ success: false, message: 'Report not found for this equipment and month.' });

    return res.json({ success: true, report });
  } catch (err) {
    console.error("Error fetching report by equipment and month:", err);
    return res.status(500).json({ success: false, message: "Server error while fetching report by equipment and month." });
  }
};
