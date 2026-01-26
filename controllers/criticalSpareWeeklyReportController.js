// FILE: controllers/criticalSpareWeeklyReportController.js
const CriticalSpareWeeklyReport = require("../models/CriticalSpareWeeklyReport");

/* ---------- SAVE ---------- */
exports.saveCriticalSpareWeeklyReport = async (req, res) => {
  try {
    const { userId, userName, siteName, year, month, week, spares } = req.body;

    if (!userName || !year || !month || !week) {
      return res.status(400).json({ message: "userName, year, month, week are required" });
    }

    if (!Array.isArray(spares)) {
      return res.status(400).json({ message: "Invalid spares payload" });
    }

    const report = await CriticalSpareWeeklyReport.findOneAndUpdate(
      { userName, year: Number(year), month: Number(month), week: Number(week) },
      {
        userId,
        userName,
        siteName,
        year: Number(year),
        month: Number(month),
        week: Number(week),
        spares,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({
      success: true,
      message: "Critical spare weekly report saved",
      report,
    });
  } catch (err) {
    console.error("WEEKLY SAVE ERROR:", err);
    res.status(500).json({ message: "Save failed" });
  }
};

/* ---------- GET ---------- */
// GET /api/critical-spares-weekly/:userName/:year/:month/:week?prefill=1
exports.getCriticalSpareWeeklyReport = async (req, res) => {
  const { userName, year, month, week } = req.params;
  const prefill = String(req.query.prefill || "") === "1";

  try {
    const report = await CriticalSpareWeeklyReport.findOne({
      userName,
      year: Number(year),
      month: Number(month),
      week: Number(week),
    }).lean();

    if (report) {
      return res.json({ success: true, spares: report?.spares || [] });
    }

    // ✅ Prefill: if no report exists, return latest saved spares list (as template)
    if (prefill) {
      const latest = await CriticalSpareWeeklyReport.findOne({ userName })
        .sort({ updatedAt: -1 })
        .lean();

      if (latest?.spares?.length) {
        return res.json({
          success: true,
          template: true,
          spares: latest.spares,
        });
      }
    }

    return res.status(404).json({ message: "Report not found" });
  } catch (err) {
    console.error("WEEKLY FETCH ERROR:", err);
    res.status(500).json({ message: "Fetch failed" });
  }
};
