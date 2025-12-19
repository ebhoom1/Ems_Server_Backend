const ChemicalConsumptionReport = require("../models/ChemicalConsumptionReport");

/* ---------- SAVE ---------- */
const saveChemicalConsumption = async (req, res) => {
  try {
    const { userId, userName, siteName, year, month, readings } = req.body;

    const report = await ChemicalConsumptionReport.findOneAndUpdate(
      { userName, year, month },
      { userId, userName, siteName, year, month, readings },
      { upsert: true, new: true }
    );

    res.status(200).json({
      success: true,
      message: "Chemical consumption report saved",
      report,
    });
  } catch (err) {
    console.error("SAVE ERROR:", err);
    res.status(500).json({ message: "Save failed" });
  }
};

/* ---------- GET ---------- */
const getChemicalConsumption = async (req, res) => {
  const { userName, year, month } = req.params;

  try {
    const report = await ChemicalConsumptionReport.findOne({
      userName,
      year: Number(year),
      month: Number(month),
    });

    if (!report) {
      return res.status(200).json({ success: true, readings: [] });
    }

    res.status(200).json({
      success: true,
      readings: report.readings,
      siteName: report.siteName,
    });
  } catch (err) {
    res.status(500).json({ message: "Fetch failed" });
  }
};

module.exports={
saveChemicalConsumption,
getChemicalConsumption
}