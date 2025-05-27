const MechanicalReport = require('../models/MechanicalReport');

exports.addMechanicalReport = async (req, res) => {
  try {
    const {
      equipmentId,
      equipmentName,
      userName,     // ✅ from frontend
      capacity,     // ✅ from frontend
      columns,
      technician,
      entries,
      timestamp
    } = req.body;

    const transformedEntries = entries.map(entry => ({
      id:          entry.id,
      category:    entry.category,
      description: entry.description,
      checks:      entry.checks.map((val, idx) => ({
                      column: columns[idx] || columns[0],
                      value:  val
                    })),
      remarks:     entry.remarks
    }));

    const report = new MechanicalReport({
      equipmentId,
      equipmentName,
      userName,
      capacity,
      columns,
      technician,
      entries: transformedEntries,
      timestamp
    });

    await report.save();
    res.json({ success: true, report });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getMechanicalReports = async (req, res) => {
  try {
    const reports = await MechanicalReport.find().sort({ timestamp: -1 });
    res.json({ success: true, reports });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
exports.getReportsByEquipment = async (req, res) => {
    try {
      const { equipmentId } = req.params;
      const reports = await MechanicalReport.find({ equipmentId }).sort({ timestamp: -1 });
      res.json({ success: true, reports });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  };
  exports.getReportsByMonth = async (req, res) => {
    try {
      const year  = parseInt(req.params.year, 10);
      const month = parseInt(req.params.month, 10); // 1–12
  
      if (
        isNaN(year) ||
        isNaN(month) ||
        month < 1 || month > 12
      ) {
        return res
          .status(400)
          .json({ success: false, message: 'Invalid year or month' });
      }
  
      // build date range [startOfMonth, startOfNextMonth)
      const startOfMonth     = new Date(year, month - 1, 1);
      const startOfNextMonth = new Date(year, month, 1);
  
      const reports = await MechanicalReport.find({
        // use `timestamp` (as you stored) or `createdAt` if you prefer
        timestamp: { $gte: startOfMonth, $lt: startOfNextMonth }
      }).sort({ timestamp: -1 });
  
      res.json({ success: true, reports });
    } catch (err) {
      console.error('Error fetching mechanical reports by month:', err);
      res
        .status(500)
        .json({ success: false, message: 'Server error', error: err.message });
    }
  };