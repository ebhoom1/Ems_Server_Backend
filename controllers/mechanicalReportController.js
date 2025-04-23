const MechanicalReport = require('../models/MechanicalReport');

exports.addMechanicalReport = async (req, res) => {
    try {
      const {
        equipmentId,
        equipmentName,
        columns,      // array of header names, e.g. ["Pump 1","Pump 2"] or ["Process Status"]
        technician,
        entries,      // entries[i].checks is still an array of raw strings
        timestamp
      } = req.body;
  
      // zip headers + values for each entry
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