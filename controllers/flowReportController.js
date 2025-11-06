const FlowReport = require('../models/FlowReport'); // Adjust path

/**
 * @desc    Save or Update a Monthly Flow Report (Upsert)
 * @route   POST /api/flow-report
 * @access  Private (Operator/Admin)
 */
const saveOrUpdateReport = async (req, res) => {
  // ... (This function is already correct and needs no changes)
  const { userId, userName, siteName, year, month, readings } = req.body;

  if (!userId || !userName || year === undefined || month === undefined || !readings) {
    return res.status(400).json({ message: 'Missing required fields.' });
  }

  try {
    const updatedReport = await FlowReport.findOneAndUpdate(
      { userId, year, month }, // Query
      { 
        $set: { // Update
          userName, 
          siteName, 
          readings // This now includes inletInitial/outletInitial from the frontend
        } 
      }, 
      { 
        new: true, 
        upsert: true,
        runValidators: true 
      }
    );

    res.status(200).json(updatedReport);
  } catch (error) {
    console.error('Error saving flow report:', error);
    res.status(500).json({ message: 'Server error while saving flow report.' });
  }
};

/**
 * @desc    Get a Monthly Flow Report
 * @route   GET /api/flow-report/:userName/:year/:month
 * @access  Private
 */
const getReport = async (req, res) => {
  const { userName, year, month } = req.params;

  try {
    const report = await FlowReport.findOne({ 
      userName, 
      year: Number(year), 
      month: Number(month) 
    });

    // --- LOGIC FOR PREVIOUS MONTH'S FINAL READING ---
    // This is still needed to fill the *first day* of the month if it's empty
    
    // Calculate previous month/year
    let prevMonth = Number(month) - 1;
    let prevYear = Number(year);
    if (prevMonth < 0) {
        prevMonth = 11; // December
        prevYear = prevYear - 1;
    }

    // Find the report from the previous month
    const prevReport = await FlowReport.findOne({
        userName,
        year: prevYear,
        month: prevMonth
    }).sort({ 'readings.date': -1 }); // Get last readings first

    let previousInletFinal = 0;
    let previousOutletFinal = 0;

    if (prevReport && prevReport.readings.length > 0) {
        // Get the last reading from the previous month
        const lastReading = prevReport.readings[prevReport.readings.length - 1];
        previousInletFinal = lastReading.inletFinal || 0;
        previousOutletFinal = lastReading.outletFinal || 0;
    }

    if (!report) {
      // If no report for *this* month, still send back the prev month's data
      return res.status(404).json({ 
          message: 'Report not found', 
          previousInletFinal, 
          previousOutletFinal 
      });
    }

    // Send the report data along with the previous month's final values
    res.status(200).json({
        ...report.toObject(),
        previousInletFinal,
        previousOutletFinal
    });

  } catch (error) {
    console.error('Error fetching flow report:', error);
    res.status(500).json({ message: 'Server error while fetching flow report.' });
  }
};

module.exports = {
  saveOrUpdateReport,
  getReport,
};