const CriticalSpareReport = require("../models/CriticalSpareReport");

/* ---------- SAVE ---------- */
exports.saveCriticalSpareReport = async (req, res) => {
  try {
    const { userId, userName, siteName, year, month, spares } = req.body;

    if (!Array.isArray(spares)) {
      return res.status(400).json({ message: "Invalid spares payload" });
    }

    const report = await CriticalSpareReport.findOneAndUpdate(
      { userName, year, month },
      {
        userId,
        userName,
        siteName,
        year,
        month,
        spares, // ✅ SAVE DIRECTLY
      },
      { upsert: true, new: true }
    );

    res.status(200).json({
      success: true,
      message: "Critical spare report saved",
      report,
    });
  } catch (err) {
    console.error("SAVE ERROR:", err);
    res.status(500).json({ message: "Save failed" });
  }
};

/* ---------- GET ---------- */
exports.getCriticalSpareReport = async (req, res) => {
  const { userName, year, month } = req.params;

  try {
    const report = await CriticalSpareReport.findOne({
      userName,
      year: Number(year),
      month: Number(month),
    });

    res.json({
      success: true,
      spares: report?.spares || [],
    });
  } catch (err) {
    res.status(500).json({ message: "Fetch failed" });
  }
};
