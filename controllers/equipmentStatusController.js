// FILE: controllers/equipmentStatusController.js
const EquipmentStatusReport = require("../models/EquipmentStatusReport");

// GET /api/equipment-status/:userId/:year/:month
const getEquipmentStatusReport = async (req, res) => {
  try {
    const { userId, year, month } = req.params;

    const y = parseInt(year, 10);
    const m = parseInt(month, 10);

    if (!userId || isNaN(y) || isNaN(m)) {
      return res.status(400).json({ message: "Invalid parameters" });
    }

    const report = await EquipmentStatusReport.findOne({
      userId,
      year: y,
      month: m,
    });

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    return res.status(200).json(report);
  } catch (err) {
    console.error("Error fetching equipment status report:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// POST /api/equipment-status
// Body: { userId, userName, siteName, year, month, entries }
const saveOrUpdateEquipmentStatusReport = async (req, res) => {
  try {
    const { userId, userName, siteName, year, month, entries } = req.body;

    if (!userId || !year || !month) {
      return res
        .status(400)
        .json({ message: "userId, year and month are required" });
    }

    const y = parseInt(year, 10);
    const m = parseInt(month, 10);

    const cleanedEntries = (entries || [])
      .filter((e) => {
        if (!e) return false;
        const hasEquipment =
          e.equipmentName && e.equipmentName.toString().trim() !== "";
        const hasOther =
          (e.capacity && e.capacity.toString().trim() !== "") ||
          (e.make && e.make.toString().trim() !== "") ||
          (e.status && e.status.toString().trim() !== "") ||
          (e.comment && e.comment.toString().trim() !== "")||
          (e.notes && e.notes.toString().trim() !== "");

        return hasEquipment || hasOther;
      })
      .map((e, idx) => ({
        slNo:
          typeof e.slNo === "number"
            ? e.slNo
            : parseInt(e.slNo, 10) || idx + 1,
        equipmentName: e.equipmentName || "",
        capacity: e.capacity || "",
        make: e.make || "",
        status: e.status || "",
        comment: e.comment || "",
        notes: e.notes || "",

      }));

    const updateDoc = {
      userId,
      userName,
      siteName,
      year: y,
      month: m,
      entries: cleanedEntries,
    };

    const report = await EquipmentStatusReport.findOneAndUpdate(
      { userId, year: y, month: m },
      updateDoc,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json(report);
  } catch (err) {
    console.error("Error saving equipment status report:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getEquipmentStatusReport,
  saveOrUpdateEquipmentStatusReport,
};
