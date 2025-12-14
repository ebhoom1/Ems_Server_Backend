const ChemicalReport = require("../models/ChemicalReport");

exports.saveChemicalReport = async (req, res) => {
  try {
    const report = await ChemicalReport.findOneAndUpdate(
      {
        userName: req.body.userName,
        chemicalName: req.body.chemicalName,
        year: req.body.year,
        month: req.body.month,
      },
      { $set: req.body },
      { upsert: true, new: true }
    );
    res.json(report);
  } catch (err) {
    res.status(500).json({ message: "Save failed" });
  }
};

exports.getChemicalReport = async (req, res) => {
  const { userName, year, month } = req.params;

  try {
    const report = await ChemicalReport.findOne({
      userName,
      year: Number(year),
      month: Number(month)
    });

    if (!report) return res.status(404).json({ message: "Not found" });

    res.status(200).json(report);
  } catch (err) {
    res.status(500).json({ message: "Fetch failed" });
  }
};
