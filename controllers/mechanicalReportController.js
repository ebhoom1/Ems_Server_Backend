
const MechanicalReport = require('../models/MechanicalReport'); // Ensure model is imported

exports.addMechanicalReport = async (req, res) => {
  console.log('--- multer files:', req.files);
  console.log('--- form fields:', req.body);

  try {
    let territorialManager = null;
    let columns = [];
    let entries = [];

    // Safely parse the territorialManager object from the form data
    if (req.body.territorialManager) {
      try {
        territorialManager = JSON.parse(req.body.territorialManager);
      } catch (jsonErr) {
        console.error('❌ Manager JSON parse failed:', req.body.territorialManager, jsonErr);
        return res.status(400).json({ success: false, message: 'Invalid territorialManager JSON' });
      }
    } else {
      // This check is important for your 'required: true' schema rule
      return res.status(400).json({ success: false, message: 'Territorial Manager is required.' });
    }

    // Safely parse columns array
    if (req.body.columns) {
      try {
        columns = JSON.parse(req.body.columns);
      } catch (jsonErr) {
        console.error('❌ Columns JSON parse failed:', req.body.columns, jsonErr);
        return res.status(400).json({ success: false, message: 'Invalid columns JSON' });
      }
    }

    // Safely parse entries array
    if (req.body.entries) {
      try {
        entries = JSON.parse(req.body.entries);
      } catch (jsonErr) {
        console.error('❌ Entries JSON parse failed:', req.body.entries, jsonErr);
        return res.status(400).json({ success: false, message: 'Invalid entries JSON' });
      }
    }

    // Get photo URLs from S3 upload
    const photoUrls = (req.files || []).map(file => file.location);

    // Transform entries to match the sub-schema structure
    let transformedEntries = [];
    if (req.body.isWorking === 'yes' && entries.length) {
      transformedEntries = entries.map(entry => ({
        id: entry.id,
        category: entry.category,
        description: entry.description,
        checks: Array.isArray(entry.checks)
          ? entry.checks.map((val, idx) => ({
              column: columns[idx] || '',
              value: val
            }))
          : [],
        remarks: entry.remarks || ''
      }));
    }

    // Create a new report document using the Mongoose model
    const report = new MechanicalReport({
      equipmentId:        req.body.equipmentId,
      equipmentName:      req.body.equipmentName,
      userName:           req.body.userName,
      capacity:           req.body.capacity,
      columns,
      territorialManager, // Use the parsed manager object
      entries:            transformedEntries,
      timestamp:          req.body.timestamp,
      isWorking:          req.body.isWorking,
      comments:           req.body.comments,
      photos:             photoUrls
    });

    // Save the document to the database
    await report.save();

    // Send a success response
    return res.json({ success: true, report });

  } catch (err) {
    // Catch any errors during the process (e.g., database validation)
    console.error('🔴 Error in addMechanicalReport:', err.stack || err);
    return res.status(500).json({ success: false, message: 'Server error saving report' });
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

//chcek if exist 
exports.checkMechanicalReportExists = async (req, res) => {
  try {
    const { equipmentId } = req.params;
    const report = await MechanicalReport.findOne({ equipmentId });
    // Send back true if a report is found, false otherwise
    res.json({ exists: !!report });
  } catch (err) {
    console.error('Error in checkMechanicalReportExists:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

//update
// Add this new function to your controller file

exports.updateMechanicalReport = async (req, res) => {
  console.log('--- updating report, fields:', req.body);
  try {
    const { reportId } = req.params;
    const report = await MechanicalReport.findById(reportId);

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    // Safely parse incoming data (similar to addMechanicalReport)
    let territorialManager = req.body.territorialManager ? JSON.parse(req.body.territorialManager) : report.territorialManager;
    let columns = req.body.columns ? JSON.parse(req.body.columns) : report.columns;
    let entries = req.body.entries ? JSON.parse(req.body.entries) : report.entries;

    // Get new photo URLs and combine with any existing ones if needed
    const newPhotoUrls = (req.files || []).map(file => file.location);
    // Note: You might want logic to remove old photos. For simplicity, we'll just add new ones.
    const allPhotos = [...report.photos, ...newPhotoUrls];

    // Transform entries to match the sub-schema structure
    let transformedEntries = [];
    if (req.body.isWorking === 'yes' && entries.length) {
      transformedEntries = entries.map(entry => ({
        id: entry.id,
        category: entry.category,
        description: entry.description,
        checks: Array.isArray(entry.checks)
          ? entry.checks.map((val, idx) => ({
              column: columns[idx] || '',
              value: val
            }))
          : [],
        remarks: entry.remarks || ''
      }));
    }

    // Update the report fields
    report.territorialManager = territorialManager;
    report.columns = columns;
    report.entries = transformedEntries;
    report.isWorking = req.body.isWorking;
    report.comments = req.body.comments;
    report.photos = allPhotos;
    report.timestamp = req.body.timestamp; // Update the timestamp to reflect the edit time

    // Save the updated document
    await report.save();

    return res.json({ success: true, report });

  } catch (err) {
    console.error('🔴 Error in updateMechanicalReport:', err.stack || err);
    return res.status(500).json({ success: false, message: 'Server error updating report' });
  }
};