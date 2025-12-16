const MonthlyReport = require("../models/MlssPh");

/* ---------------- SAVE / UPDATE ---------------- */
exports.saveOrUpdateReport = async (req, res) => {
  const { userId, userName, siteName, year, month, readings } = req.body;

  if (!userId || !userName || year === undefined || month === undefined) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const report = await MonthlyReport.findOneAndUpdate(
  { userId, year, month },
  {
    $set: {
      userName,
      siteName,
      readings
    },
    $unset: {
      flowMeterNames: "",
      inletOutletReadings: "",
      inletReadings: "",
      outletReadings: ""
    }
  },
  {
    new: true,
    upsert: true,
    runValidators: true
  }
);


    res.status(200).json(report);
  } catch (err) {
    console.error("Save Monthly Report Error:", err);
    res.status(500).json({ message: "Failed to save monthly report" });
  }
};

/* ---------------- GET REPORT ---------------- */
exports.getMonthlyReport = async (req, res) => {
  const { userName, year, month } = req.params;

  try {
    const report = await MonthlyReport.findOne({
      userName,
      year: Number(year),
      month: Number(month) // now 1–12
    });

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    res.status(200).json(report);
  } catch (err) {
    console.error("Fetch Monthly Report Error:", err);
    res.status(500).json({ message: "Failed to fetch report" });
  }
};
