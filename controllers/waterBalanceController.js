const WaterBalanceReport = require("../models/WaterBalanceReport");

/* ---------- MAP FRONTEND → DB ---------- */
const mapToDb = (r) => ({
  date: r.date,

  greyWaterInitial: r.greyInit,
  greyWaterFinal: r.greyFinal,
  greyWaterTotal: r.greyTotal,
  soilLine: r.soilLine,
  equalization: r.equalization,
  totalGreySoil: r.totalGreySoil,

  inletInitial: r.inletInit,
  inletFinal: r.inletFinal,
  inletTotal: r.inletTotal,

  permeateInitial: r.permeateInit,
  permeateFinal: r.permeateFinal,
  permeateTotal: r.permeateTotal,

  finalTankLevel: r.finalTank,

  cBlockInitial: r.cInit,
  cBlockFinal: r.cFinal,
  cBlockTotal: r.cTotal,

  mBlockInitial: r.mInit,
  mBlockFinal: r.mFinal,
  mBlockTotal: r.mTotal,

  gBlockInitial: r.gInit,
  gBlockFinal: r.gFinal,
  gBlockTotal: r.gTotal,

  gardenInitial: r.gardenInit,
  gardenFinal: r.gardenFinal,
  gardenTotal: r.gardenTotal,

  treatedViaG: r.treatedViaG,
});

/* ---------- MAP DB → FRONTEND ---------- */
const mapToFrontend = (r) => ({
  date: r.date,

  greyInit: r.greyWaterInitial || "",
  greyFinal: r.greyWaterFinal || "",
  greyTotal: r.greyWaterTotal || "",
  soilLine: r.soilLine || "",
  equalization: r.equalization || "",
  totalGreySoil: r.totalGreySoil || "",

  inletInit: r.inletInitial || "",
  inletFinal: r.inletFinal || "",
  inletTotal: r.inletTotal || "",

  permeateInit: r.permeateInitial || "",
  permeateFinal: r.permeateFinal || "",
  permeateTotal: r.permeateTotal || "",

  finalTank: r.finalTankLevel || "",

  cInit: r.cBlockInitial || "",
  cFinal: r.cBlockFinal || "",
  cTotal: r.cBlockTotal || "",

  mInit: r.mBlockInitial || "",
  mFinal: r.mBlockFinal || "",
  mTotal: r.mBlockTotal || "",

  gInit: r.gBlockInitial || "",
  gFinal: r.gBlockFinal || "",
  gTotal: r.gBlockTotal || "",

  gardenInit: r.gardenInitial || "",
  gardenFinal: r.gardenFinal || "",
  gardenTotal: r.gardenTotal || "",

  treatedViaG: r.treatedViaG || "",
});

/* ---------- SAVE ---------- */
exports.saveWaterBalance = async (req, res) => {
  try {
    const { userId, userName, siteName, year, month, readings } = req.body;

    const mappedReadings = readings.map(mapToDb);

    const report = await WaterBalanceReport.findOneAndUpdate(
      { userName, year, month },
      { userId, userName, siteName, year, month, readings: mappedReadings },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: "Water Balance report saved",
      report,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Save failed" });
  }
};

/* ---------- GET ---------- */
exports.getWaterBalance = async (req, res) => {
  try {
    const { userName, year, month } = req.params;

    const report = await WaterBalanceReport.findOne({
      userName,
      year: Number(year),
      month: Number(month),
    });

    res.json({
      success: true,
      readings: report
        ? report.readings.map(mapToFrontend)
        : [],
      siteName: report?.siteName || "",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Fetch failed" });
  }
};
