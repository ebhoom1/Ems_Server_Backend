const ElectricalReport = require('../models/ElectricalReport');
const Equipment       = require('../models/equipment'); 
// controllers/electricalReport.js


// exports.createReport = async (req, res) => {
//   try {
//     const { equipmentId, technician, equipment, responses } = req.body;
//     const userName = (req.user && req.user.userName)    // from auth middleware
//                   || req.body.userName;               // or from body

//     // --- Validation ---
//     if (!equipmentId) {
//       return res.status(400).json({ success: false, message: 'equipmentId is required' });
//     }
//     if (!technician || !technician.name || !technician.email) {
//       return res.status(400).json({ success: false, message: 'Technician name & email are required' });
//     }
//     if (!equipment || !equipment.name) {
//       return res.status(400).json({ success: false, message: 'Equipment details are required' });
//     }
//     if (!responses || typeof responses !== 'object') {
//       return res.status(400).json({ success: false, message: 'Responses are required' });
//     }
//     if (!userName) {
//       return res.status(400).json({ success: false, message: 'userName is required' });
//     }

//     // --- Convert plain object to Map for mongoose ---
//     const responsesMap = new Map(
//       Object.entries(responses).map(([key, value]) => [key, value])
//     );

//     // --- Create the report, setting hasElectricalReport to true ---
//     const report = new ElectricalReport({
//       equipmentId,
//       technician,
//       equipment,
//       responses: responsesMap,
//       userName,
//       hasElectricalReport: true    // ← flag set here
//     });

//     await report.save();

//     // --- Also update the Equipment document’s flag ---
//     await Equipment.findByIdAndUpdate(
//       equipmentId,
//       { $set: { hasElectricalReport: true } },
//       { new: true }
//     );

//     return res.status(201).json({ success: true, report });
//   } catch (err) {
//     console.error('🔴 Error creating ElectricalReport:', err);
//     return res.status(500).json({ success: false, message: 'Server error' });
//   }
// };

exports.createReport = async (req, res) => {
  try {
      const { equipmentId, technician, equipment, responses } = req.body;
      // userName can come from auth middleware (req.user) or directly from the body
      const userName = (req.user && req.user.userName) || req.body.userName; 

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
      if (!userName) { // Ensure userName is present for linking the report
          return res.status(400).json({ success: false, message: 'userName is required' });
      }

      // --- Convert plain object to Map for Mongoose (for `responses`) ---
      const responsesMap = new Map(
          Object.entries(responses).map(([key, value]) => [key, value])
      );

      // --- Determine current month and year for upsert logic ---
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1; // JS months are 0-11
      const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
      const endOfMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59);

      // --- Find an existing report for the current equipment and month ---
      let existingReport = await ElectricalReport.findOne({
          equipmentId,
          createdAt: { $gte: startOfMonth, $lt: endOfMonth }
      });

      let report;
      if (existingReport) {
          // If report exists, update its fields
          existingReport.technician = technician;
          existingReport.equipment = equipment;
          existingReport.responses = responsesMap;
          existingReport.userName = userName; // Update userName if it somehow changed
          report = await existingReport.save();
      } else {
          // If no report exists, create a new one
          report = new ElectricalReport({
              equipmentId,
              technician,
              equipment,
              responses: responsesMap,
              userName,
          });
          await report.save();
      }

      // Note: The `hasElectricalReport` field on the `Equipment` model is also no longer needed
      // as existence is now determined by querying `ElectricalReport` directly for the month/year.

      return res.status(201).json({ success: true, report });
  } catch (err) {
      console.error('🔴 Error creating/updating ElectricalReport:', err);
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

exports.getReportByEquipmentAndMonth = async (req, res) => {
  try {
      const { equipmentId } = req.params;
      const { year, month } = req.query;

      // Validate that year and month were provided
      if (!year || !month) {
          return res.status(400).json({
              success: false,
              message: "Year and month query parameters are required.",
          });
      }

      // Create a date range for the beginning and end of the specified month
      const startDate = new Date(year, month - 1, 1); // JS months are 0-indexed
      const endDate = new Date(year, month, 0, 23, 59, 59); // Last millisecond of the month

      // Query the database for a report within the date range for the specific equipment
      const report = await ElectricalReport.findOne({
          equipmentId: equipmentId,
          createdAt: {
              $gte: startDate,
              $lte: endDate,
          },
      });

      if (!report) {
          return res.status(404).json({ success: false, message: 'Report not found for this equipment and month.' });
      }

      return res.json({ success: true, report });

  } catch (err) {
      console.error("Error fetching report by equipment and month:", err);
      return res.status(500).json({
          success: false,
          message: "Server error while fetching report by equipment and month.",
      });
  }
};