const ElectricalReport = require('../models/ElectricalReport');
const Equipment       = require('../models/equipment'); 
// controllers/electricalReport.js


exports.createReport = async (req, res) => {
  try {
    const { equipmentId, technician, equipment, responses } = req.body;
    const userName = (req.user && req.user.userName)    // from auth middleware
                  || req.body.userName;               // or from body

    // --- Validation ---
    if (!equipmentId) {
      return res.status(400).json({ success: false, message: 'equipmentId is required' });
    }
    if (!technician || !technician.name || !technician.email) {
      return res.status(400).json({ success: false, message: 'Technician name & email are required' });
    }
    if (!equipment || !equipment.name) {
      return res.status(400).json({ success: false, message: 'Equipment details are required' });
    }
    if (!responses || typeof responses !== 'object') {
      return res.status(400).json({ success: false, message: 'Responses are required' });
    }
    if (!userName) {
      return res.status(400).json({ success: false, message: 'userName is required' });
    }

    // --- Convert plain object to Map for mongoose ---
    const responsesMap = new Map(
      Object.entries(responses).map(([key, value]) => [key, value])
    );

    // --- Create the report, setting hasElectricalReport to true ---
    const report = new ElectricalReport({
      equipmentId,
      technician,
      equipment,
      responses: responsesMap,
      userName,
      hasElectricalReport: true    // ← flag set here
    });

    await report.save();

    // --- Also update the Equipment document’s flag ---
    await Equipment.findByIdAndUpdate(
      equipmentId,
      { $set: { hasElectricalReport: true } },
      { new: true }
    );

    return res.status(201).json({ success: true, report });
  } catch (err) {
    console.error('🔴 Error creating ElectricalReport:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};



exports.getAllReports = async (req, res) => {
  try {
    const reports = await ElectricalReport.find().sort({ createdAt: -1 });
    res.json({ success: true, reports });
  } catch (err) {
    console.error('Error fetching reports:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getReportByEquipment = async (req, res) => {
  try {
    const { equipmentId } = req.params;
    const report = await ElectricalReport.findOne({ equipmentId });
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found for this equipment' });
    }
    res.json({ success: true, report });
  } catch (err) {
    console.error('Error fetching report:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deleteReport = async (req, res) => {
  try {
    const result = await ElectricalReport.findByIdAndDelete(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }
    res.json({ success: true, message: 'Report deleted' });
  } catch (err) {
    console.error('Error deleting report:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getReportById = async (req, res) => {
  try {
    const { id } = req.params;
    const report = await ElectricalReport.findById(id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }
    res.json({ success: true, report });
  } catch (err) {
    console.error('Error fetching report by ID:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getReportsByMonth = async (req, res) => {
  try {
    const year  = parseInt(req.params.year,  10);
    const month = parseInt(req.params.month, 10);
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ success: false, message: 'Invalid year or month' });
    }

    const startOfMonth     = new Date(year, month - 1, 1);
    const startOfNextMonth = new Date(year, month,     1);

    const reports = await ElectricalReport.find({
      createdAt: { $gte: startOfMonth, $lt: startOfNextMonth }
    }).sort({ createdAt: -1 });

    res.json({ success: true, reports });
  } catch (err) {
    console.error('Error fetching reports by month:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getReportsByUserMonth = async (req, res) => {
  try {
    const { userName, year, month } = req.params;
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);

    if (isNaN(y) || isNaN(m) || m < 1 || m > 12) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid year or month' });
    }

    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);

    // This is the key change: Include 'userName' directly in the query
    const reports = await ElectricalReport.find({
      userName: userName, // <-- Filter by the userName parameter
      createdAt: { $gte: start, $lt: end }
    }).sort({ createdAt: -1 });

    // You can remove the commented-out lines now that you've confirmed
    // 'userName' is a direct field.

    res.json({ success: true, reports });
  } catch (err) {
    console.error('Error fetching reports by user/month:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// controllers/reportController.js

exports.reportExists = async (req, res) => {
  try {
    // 1. Get equipmentId from route parameters
    const { equipmentId } = req.params;
    // 2. Get year and month from query string
    const { year, month } = req.query;

    // 3. Validate that year and month were provided
    if (!year || !month) {
      return res.status(400).json({
        success: false,
        message: "Year and month query parameters are required.",
      });
    }

    // 4. Create a date range for the beginning and end of the specified month
    // Note: The month in JavaScript's Date object is 0-indexed (0=Jan, 1=Feb, etc.)
    const startDate = new Date(year, month - 1, 1);
    // By setting the day to 0 for the *next* month, we get the last day of the *current* month
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // 5. Query the database for a report within the date range
    // We assume your model has a timestamp field like 'createdAt'. 
    // If you use a different field (e.g., 'reportDate'), change 'createdAt' below.
    const report = await ElectricalReport.findOne({
      equipmentId: equipmentId,
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    });

    // 6. Return true if a report was found (report is not null), otherwise false
    return res.json({ success: true, exists: !!report });

  } catch (err) {
    console.error("Error checking if report exists:", err);
    return res.status(500).json({ 
        success: false, 
        message: "Server error while checking report existence." 
    });
  }
};