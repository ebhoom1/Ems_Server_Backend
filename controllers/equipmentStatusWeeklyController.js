// FILE: controllers/equipmentStatusWeeklyController.js
const EquipmentStatusWeeklyReport = require("../models/EquipmentStatusWeeklyReport");

const daysInMonth = (year, month) => new Date(year, month, 0).getDate(); // month=1..12

const validWeek = (week) => [1, 2, 3, 4].includes(Number(week));

const weekRanges = (year, month) => {
  const dim = daysInMonth(year, month);
  return [
    { week: 1, start: 1, end: 7 },
    { week: 2, start: 8, end: 14 },
    { week: 3, start: 15, end: 21 },
    { week: 4, start: 22, end: dim },
  ];
};

// GET /api/equipment-status-weekly/:userId/:year/:month/:week
// GET /api/equipment-status-weekly/:userId/:year/:month/:week?prefill=1
const getEquipmentStatusWeeklyReport = async (req, res) => {
  try {
    const { userId, year, month, week } = req.params;

    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    const w = parseInt(week, 10);

    const prefill = String(req.query.prefill || "") === "1";

    if (!userId || isNaN(y) || isNaN(m) || isNaN(w) || ![1,2,3,4].includes(w)) {
      return res.status(400).json({ message: "Invalid parameters" });
    }

    const report = await EquipmentStatusWeeklyReport.findOne({
      userId,
      year: y,
      month: m,
      week: w,
    });

    // ✅ If report exists -> normal return
    if (report) return res.status(200).json(report);

    // ✅ If not found + prefill=1 -> return latest entries as template (if any)
    if (prefill) {
      const latest = await EquipmentStatusWeeklyReport.findOne({ userId })
        .sort({ updatedAt: -1 })
        .lean();

      if (latest?.entries?.length) {
        return res.status(200).json({
          template: true,
          userId,
          year: y,
          month: m,
          week: w,
          note: "",                 // start with blank note for new week
          entries: latest.entries,  // reuse last saved equipment list
        });
      }
    }

    return res.status(404).json({ message: "Report not found" });
  } catch (err) {
    console.error("Error fetching equipment status weekly report:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// POST /api/equipment-status-weekly
// Body: { userId, userName, siteName, year, month, week, entries, note }
const saveOrUpdateEquipmentStatusWeeklyReport = async (req, res) => {
  try {
    const { userId, userName, siteName, year, month, week, entries, note } =
      req.body;

    if (!userId || !year || !month || !week) {
      return res
        .status(400)
        .json({ message: "userId, year, month and week are required" });
    }

    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    const w = parseInt(week, 10);

    if (isNaN(y) || isNaN(m) || isNaN(w) || !validWeek(w)) {
      return res.status(400).json({ message: "Invalid year/month/week" });
    }

    // (optional) keep ranges handy if you want to display it in UI
    const ranges = weekRanges(y, m);
    const selectedRange = ranges.find((r) => r.week === w);

    const cleanedEntries = (entries || [])
      .filter((e) => {
        if (!e) return false;
        const hasEquipment =
          e.equipmentName && e.equipmentName.toString().trim() !== "";
        const hasOther =
          (e.capacity && e.capacity.toString().trim() !== "") ||
          (e.make && e.make.toString().trim() !== "") ||
          (e.status && e.status.toString().trim() !== "") ||
          (e.comment && e.comment.toString().trim() !== "");
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
      }));

    const updateDoc = {
      userId,
      userName,
      siteName,
      year: y,
      month: m,
      week: w,
      note: note || "",
      entries: cleanedEntries,
      // OPTIONAL: store range for easier PDF titles (not necessary)
      // weekStart: selectedRange?.start,
      // weekEnd: selectedRange?.end,
    };

    const report = await EquipmentStatusWeeklyReport.findOneAndUpdate(
      { userId, year: y, month: m, week: w },
      updateDoc,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json(report);
  } catch (err) {
    console.error("Error saving equipment status weekly report:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getEquipmentStatusWeeklyReport,
  saveOrUpdateEquipmentStatusWeeklyReport,
};
