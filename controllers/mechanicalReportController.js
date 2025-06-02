// controllers/mechanicalReportController.js
const MechanicalReport = require('../models/MechanicalReport');

exports.addMechanicalReport = async (req, res) => {
  console.log('--- multer files:', req.files);
  console.log('--- form fields:', req.body);

  try {
    // parse technician safely
    let technician = null;
    if (req.body.technician) {
      try {
        technician = JSON.parse(req.body.technician);
      } catch (jsonErr) {
        console.error('❌ Technician JSON parse failed:', req.body.technician, jsonErr);
        return res.status(400).json({ success: false, message: 'Invalid technician JSON' });
      }
    }

    // parse columns/entries safely
    const columns = req.body.columns ? JSON.parse(req.body.columns) : [];
    const entries = req.body.entries ? JSON.parse(req.body.entries) : [];

    // build photo URLs
    const photoUrls = (req.files || []).map(file => file.location);

    // transform entries
    let transformedEntries = [];
    if (req.body.isWorking === 'yes' && entries.length) {
      transformedEntries = entries.map(entry => ({
        id: entry.id,
        category: entry.category,
        description: entry.description,
        checks: Array.isArray(entry.checks)
          ? entry.checks.map((val, idx) => ({
              column: columns[idx] || columns[0] || '',
              value: val
            }))
          : [],
        remarks: entry.remarks || ''
      }));
    }

    // create and save the report
    const report = new MechanicalReport({
      equipmentId: req.body.equipmentId,
      equipmentName: req.body.equipmentName,
      userName: req.body.userName,
      capacity: req.body.capacity,
      columns,
      technician,
      entries: transformedEntries,
      timestamp: req.body.timestamp,
      isWorking: req.body.isWorking,
      comments: req.body.comments,
      photos: photoUrls
    });

    await report.save();
    return res.json({ success: true, report });

  } catch (err) {
    // Print the full error stack so you know exactly what failed:
    console.error('🔴 Error in addMechanicalReport:', err.stack || err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};


exports.getReportsByEquipment = async (req, res) => {
  try {
    const { equipmentId } = req.params;
    const reports = await MechanicalReport.find({ equipmentId });
    if (!reports.length) {
      return res.json({ success: false, message: 'No report found.' });
    }
    // Since we already stored URLs, there’s no Buffer conversion here
    res.json({ success: true, reports });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getMechanicalReports = async (req, res) => {
  try {
    const reports = await MechanicalReport.find({});
    res.json({ success: true, reports });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* exports.getReportsByMonth = async (req, res) => {
  try {
    const year  = parseInt(req.params.year,  10);
    const month = parseInt(req.params.month, 10);
    if (isNaN(year)|| isNaN(month) || month<1||month>12) {
      return res.status(400).json({ success:false, message:'Invalid year/month' });
    }
    const start = new Date(year, month-1, 1);
    const end   = new Date(year, month,   1);
    const reports = await MechanicalReport
      .find({ timestamp:{ $gte:start, $lt:end } })
      .sort({ timestamp:-1 });
    res.json({ success: true, reports });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}; */
exports.getReportsByUserAndMonth = async (req, res) => {
  console.log(
    '>>> HIT getReportsByUserAndMonth →',
    'userName=', req.params.userName,
    'year=', req.params.year,
    'month=', req.params.month
  );
  try {
    const year     = parseInt(req.params.year,  10);
    const month    = parseInt(req.params.month, 10);
    const { userName } = req.params;

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid year or month' });
    }

    // build start/end of month
    const start = new Date(year, month - 1, 1);
    const end   = new Date(year, month,     1);

    // query by userName and timestamp range
    const reports = await MechanicalReport.find({
      userName,
      timestamp: { $gte: start, $lt: end }
    }).sort({ timestamp: -1 });

    if (!reports.length) {
      return res.json({ success: false, message: 'No reports found.' });
    }

    res.json({ success: true, reports });
  } catch (err) {
    console.error('Error in getReportsByUserAndMonth:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};