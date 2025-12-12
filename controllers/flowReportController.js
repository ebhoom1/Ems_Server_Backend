const FlowReport = require('../models/FlowReport'); // Adjust path

/**
 * @desc    Save or Update a Monthly Flow Report (Upsert)
 * @route   POST /api/flow-report
 * @access  Private (Operator/Admin)
 */
const saveOrUpdateReport = async (req, res) => {
  const {
    userId,
    userName,
    siteName,
    year,
    month,
    readings,
    flowMeters
  } = req.body;

  if (!userId || !userName || !year && year !== 0 || !month && month !== 0) {
    return res.status(400).json({ message: "Missing required fields." });
  }

  try {
    const updatedReport = await FlowReport.findOneAndUpdate(
      { userName, year, month },   // ✅ Consistent with GET API
      {
        $set: {
          userId,
          userName,
          siteName,
          readings,
          flowMeters: flowMeters && flowMeters.length ? flowMeters : ["Inlet", "Outlet"]
        }
      },
      { new: true, upsert: true, runValidators: true }
    );

    return res.status(200).json(updatedReport);

  } catch (error) {
    console.error("Error saving flow report:", error);
    return res.status(500).json({ message: "Server error while saving flow report." });
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

    const flowMeters = report?.flowMeters || ["Inlet", "Outlet"];

    // --- Get previous month's last values ---
    let prevMonth = Number(month) - 1;
    let prevYear = Number(year);

    if (prevMonth < 0) {
      prevMonth = 11;
      prevYear--;
    }

    const prevReport = await FlowReport.findOne({
      userName,
      year: prevYear,
      month: prevMonth
    });

    let previousFinals = {};

    if (prevReport?.readings?.length) {
      const last = prevReport.readings[prevReport.readings.length - 1];
      Object.keys(last).forEach((k) => {
        if (k.endsWith("_final")) previousFinals[k] = last[k];
      });
    }

    if (!report) {
      return res.status(404).json({
        message: "Report not found",
        previousFinals,
        flowMeters
      });
    }

    return res.status(200).json({
      ...report.toObject(),
      flowMeters,
      previousFinals
    });

  } catch (error) {
    console.error("Error fetching flow report:", error);
    return res.status(500).json({ message: "Server error while fetching report." });
  }
};

module.exports = {
  saveOrUpdateReport,
  getReport,
};