const ElectricalReport = require('../models/ElectricalReport');

exports.createReport = async (req, res) => {
  try {
    const { equipmentId, technician, equipment, responses } = req.body;

    // 1) equipmentId is required
    if (!equipmentId) {
      return res.status(400).json({ success: false, message: 'equipmentId is required' });
    }

    // 2) technician must be present (name + email at minimum)
    if (!technician || !technician.name || !technician.email) {
      return res.status(400).json({ success: false, message: 'Technician name & email are required' });
    }

    // 3) equipment object is required
    if (!equipment || !equipment.name) {
      return res.status(400).json({ success: false, message: 'Equipment details are required' });
    }

    // 4) responses must be an object with keys "1"–"8"
    if (!responses || typeof responses !== 'object') {
      return res.status(400).json({ success: false, message: 'Responses are required' });
    }

    // 5) Convert plain object into a Map so Mongoose can cast to Map<ResponseSchema>
    const responsesMap = new Map(
      Object.entries(responses).map(([key, value]) => [key, value])
    );

    // 6) Build & save the report
    const report = new ElectricalReport({
      equipmentId,
      technician,
      equipment,
      responses: responsesMap
    });

    await report.save();
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
      return res
        .status(404)
        .json({ success: false, message: 'Report not found for this equipment' });
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
      return res
        .status(404)
        .json({ success: false, message: 'Report not found' });
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
      return res
        .status(404)
        .json({ success: false, message: 'Report not found' });
    }
    res.json({ success: true, report });
  } catch (err) {
    console.error('Error fetching report by ID:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getReportsByMonth = async (req, res) => {
  try {
    const year = parseInt(req.params.year, 10);
    const month = parseInt(req.params.month, 10); // 1 = January, 12 = December

    if (
      isNaN(year) || year < 1970 ||
      isNaN(month) || month < 1 || month > 12
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid year or month'
      });
    }

    const startOfMonth = new Date(year, month - 1, 1);
    const startOfNextMonth = new Date(year, month, 1);

    const reports = await ElectricalReport.find({
      createdAt: { $gte: startOfMonth, $lt: startOfNextMonth }
    }).sort({ createdAt: -1 });

    res.json({ success: true, reports });
  } catch (err) {
    console.error('Error fetching reports by month:', err);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: err.message
    });
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

    const reports = await ElectricalReport.find({
      "equipment.name": { $exists: true }, // if you want to filter by equipment.owner or a userName field
      createdAt: { $gte: start, $lt: end }
    }).sort({ createdAt: -1 });

    // If you truly have a `userName` field on ElectricalReport, replace above line with:
    // const reports = await ElectricalReport.find({
    //   userName,
    //   createdAt: { $gte: start, $lt: end }
    // }).sort({ createdAt: -1 });

    res.json({ success: true, reports });
  } catch (err) {
    console.error('Error fetching reports by user/month:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
