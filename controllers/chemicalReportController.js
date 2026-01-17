const ChemicalMonthlyReport = require("../models/ChemicalReport");

// POST /api/chemical-report
exports.saveMonthlyChemicalReport = async (req, res) => {
  try {
    const { userName, year, month } = req.body;

    if (!userName || !year || !month) {
      return res.status(400).json({ message: "userName, year, month are required" });
    }

    const report = await ChemicalMonthlyReport.findOneAndUpdate(
      { userName, year: Number(year), month: Number(month) },
      { $set: req.body },
      { upsert: true, new: true }
    );

    res.status(200).json(report);
  } catch (err) {
    console.error("SAVE REPORT ERROR:", err);
    res.status(500).json({ message: "Save failed" });
  }
};

// GET /api/chemical-report/:userName/:year/:month
exports.getMonthlyChemicalReport = async (req, res) => {
  const { userName, year, month } = req.params;

  try {
    const report = await ChemicalMonthlyReport.findOne({
      userName,
      year: Number(year),
      month: Number(month),
    });

    if (!report) return res.status(404).json({ message: "Not found" });

    res.status(200).json(report);
  } catch (err) {
    console.error("FETCH REPORT ERROR:", err);
    res.status(500).json({ message: "Fetch failed" });
  }
};
