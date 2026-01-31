const ChemicalReportV2 = require("../models/ChemicalReportV2");

exports.saveReport = async (req, res) => {
   try {
    const { userName, siteName, year, month, chemicals } = req.body;

    if (!userName || !year || !month) {
      return res.status(400).json({ message: "userName, year, month are required" });
    }

    // ✅ Ensure chemicalName exists (avoid saving blank objects)
    const cleanedChemicals = (chemicals || [])
      .filter((c) => (c.chemicalName || "").trim())
      .map((c) => ({
        chemicalName: String(c.chemicalName).trim().toUpperCase(),
        rows: Array.isArray(c.rows) ? c.rows : [],
      }));

    const doc = await ChemicalReportV2.findOneAndUpdate(
      { userName, year: Number(year), month: Number(month) },
      {
        $set: {
          userName,
          siteName: siteName || "",
          year: Number(year),
          month: Number(month),
          chemicals: cleanedChemicals, // ✅ saves chemicalName
        },
      },
      { upsert: true, new: true }
    );

    return res.status(200).json(doc);
  } catch (err) {
    console.error("SAVE CHEM V2 ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getReport = async (req, res) => {
  try {
    const { userName, year, month } = req.params;
    const report = await ChemicalReportV2.findOne({ userName, year, month });
    if (!report) return res.status(404).json({ message: "No data found" });
    res.status(200).json(report);
  } catch (err) {
    res.status(500).json({ message: "Error fetching data" });
  }
};