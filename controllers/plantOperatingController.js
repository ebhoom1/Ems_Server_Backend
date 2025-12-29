const PlantOperatingReport = require("../models/PlantOperatingReport");

/* ---------------------------------------
   SAVE / UPDATE REPORT
--------------------------------------- */
exports.savePlantOperatingReport = async (req, res) => {
  try {
    const {
      userId,
      userName,
      siteName,
      clientName,
      utility,
      capacity,
      month,
      parameters,
    } = req.body;

    if (!userId || !userName || !month) {
      return res.status(400).json({
        message: "userId, userName and month are required",
      });
    }

    const report = await PlantOperatingReport.findOneAndUpdate(
      { userName, month },
      {
        userId,
        userName,
        siteName,
        clientName,
        utility,
        capacity,
        month,
        parameters,
      },
      { upsert: true, new: true }
    );

    res.status(200).json({
      success: true,
      message: "Plant operating report saved",
      report,
    });
  } catch (err) {
    console.error("SAVE PLANT OPERATING ERROR:", err);
    res.status(500).json({ message: "Failed to save report" });
  }
};

/* ---------------------------------------
   GET REPORT
--------------------------------------- */
exports.getPlantOperatingReport = async (req, res) => {
  try {
    const { userName, month } = req.params;

    const report = await PlantOperatingReport.findOne({
      userName,
      month,
    });

    if (!report) {
      return res.status(200).json({
        success: true,
        parameters: [],
        clientName: "",
        utility: "STP",
        capacity: "",
      });
    }

    res.status(200).json({
      success: true,
      clientName: report.clientName,
      utility: report.utility,
      capacity: report.capacity,
      parameters: report.parameters,
    });
  } catch (err) {
    console.error("GET PLANT OPERATING ERROR:", err);
    res.status(500).json({ message: "Failed to fetch report" });
  }
};
