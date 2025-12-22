const PowerConsumptionReport = require("../models/PowerConsumptionReport");

/* ---------- SAVE ---------- */
exports.savePowerConsumption = async (req, res) => {
  try {
    const { userId, userName, siteName, year, month, readings } = req.body;

    const report = await PowerConsumptionReport.findOneAndUpdate(
      { userName, year, month },
      {
        userId,
        userName,
        siteName,
        year,
        month,
        readings,
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: "Power consumption report saved",
      report,
    });
  } catch (err) {
    console.error("SAVE ERROR:", err);
    res.status(500).json({ message: "Save failed" });
  }
};

/* ---------- GET ---------- */
exports.getPowerConsumption = async (req, res) => {
  const { userName, year, month } = req.params;

  try {
    const report = await PowerConsumptionReport.findOne({
      userName,
      year: Number(year),
      month: Number(month),
    });

    if (!report) {
      return res.json({ success: true, readings: [] });
    }

    res.json({
      success: true,
      readings: report.readings,
      siteName: report.siteName,
    });
  } catch (err) {
    res.status(500).json({ message: "Fetch failed" });
  }
};
