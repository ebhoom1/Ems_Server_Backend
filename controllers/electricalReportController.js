const ElectricalReport = require('../models/ElectricalReport');

exports.createReport = async (req, res) => {
  try {
    const { technician, equipment, responses } = req.body;
    // ensure technician is present
    if (!technician || !technician.name) {
      return res.status(400).json({
        success: false,
        message: 'Technician details are required'
      });
    }
    const report = new ElectricalReport({
      technician,
      equipment,
      responses
    });
    await report.save();
    res.status(201).json({ success: true, report });
  } catch (err) {
    console.error('Error creating report:', err);
    res.status(500).json({ success: false, message: 'Server error' });
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

exports.getReportById = async (req, res) => {
  try {
    const report = await ElectricalReport.findById(req.params.id);
    if (!report) {
      return res
        .status(404)
        .json({ success: false, message: 'Report not found' });
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
