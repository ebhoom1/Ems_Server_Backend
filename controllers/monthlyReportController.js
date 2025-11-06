const MonthlyReport = require('../models/MonthlyReport'); // Adjust path as needed

/**
 * @desc    Save or Update a Monthly Report (Upsert)
 * @route   POST /api/monthly-report
 * @access  Private (Operator/Admin)
 */
const saveOrUpdateReport = async (req, res) => {
  const { userId, userName, siteName, year, month, readings } = req.body;

  // Basic validation
  if (!userId || !userName || year === undefined || month === undefined || !readings) {
    return res.status(400).json({ message: 'Missing required fields.' });
  }

  try {
    // Find a report matching the user, year, and month, and update it.
    // If it doesn't exist, create it (upsert: true).
    const updatedReport = await MonthlyReport.findOneAndUpdate(
      { userId, year, month }, // Query: Find this document
      { 
        $set: { // Update: Set these fields
          userName, 
          siteName, 
          readings 
        } 
      }, 
      { 
        new: true, // Return the new, updated document
        upsert: true, // Create the document if it doesn't exist
        runValidators: true // Run schema validation
      }
    );

    res.status(200).json(updatedReport);
  } catch (error) {
    console.error('Error saving report:', error);
    res.status(500).json({ message: 'Server error while saving report.' });
  }
};

/**
 * @desc    Get a Monthly Report
 * @route   GET /api/monthly-report/:userName/:year/:month
 * @access  Private
 */
const getReport = async (req, res) => {
  const { userName, year, month } = req.params;

  try {
    const report = await MonthlyReport.findOne({ 
      userName, 
      year: Number(year), 
      month: Number(month) 
    });

    if (!report) {
      return res.status(404).json({ message: 'Report not found for this user and date.' });
    }

    res.status(200).json(report);
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({ message: 'Server error while fetching report.' });
  }
};

module.exports = {
  saveOrUpdateReport,
  getReport,
};