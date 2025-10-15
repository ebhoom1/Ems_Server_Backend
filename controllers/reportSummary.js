// // controllers/reportSummary.js
// const ElectricalReport = require("../models/ElectricalReport");
// const MechanicalReport = require("../models/MechanicalReport");
// const ServiceReport = require("../models/ServiceReport");
// const SafetyReport = require("../models/SafetyReport");
// const EngineerVisitReport = require("../models/EngineerVisitReport");

// /**
//  * Unified monthly summary across all report types.
//  * Handles different date and user fields per schema.
//  */
// const reportSummary = async (req, res) => {
//   try {
//     const { month, year } = req.params;
//     const start = new Date(year, month - 1, 1);
//     const end = new Date(year, month, 1);

//     // 🔹 Generic aggregation helper
//     const countReports = async (Model, dateField, nameField) =>
//       Model.aggregate([
//         {
//           $match: {
//             [dateField]: { $gte: start, $lt: end },
//           },
//         },
//         {
//           $group: {
//             _id: { $ifNull: [`$${nameField}`, "$customerName"] },
//             count: { $sum: 1 },
//           },
//         },
//       ]);

//     // 🔸 Each collection with its date and user fields
//     const [electrical, mechanical, service, safety, visits] = await Promise.all([
//       countReports(ElectricalReport, "date", "userName"), // ✅ has userName + reportDate
//       countReports(MechanicalReport, "timestamp", "userName"), // ✅ timestamp field
//       countReports(ServiceReport, "reportDate", "userName"), // ✅ userName + reportDate
//       countReports(SafetyReport, "date", "customerName"), // ✅ date + customerName
//       countReports(EngineerVisitReport, "date", "customerName"), // ✅ date + customerName
//     ]);

//     // 🔹 Combine all counts
//     const summary = {};
//     const addToSummary = (arr, key) => {
//       arr.forEach(({ _id, count }) => {
//         if (!_id) return;
//         if (!summary[_id]) summary[_id] = {};
//         summary[_id][key] = count;
//       });
//     };

//     addToSummary(electrical, "EPM");
//     addToSummary(mechanical, "MPM");
//     addToSummary(service, "Service");
//     addToSummary(safety, "Safety");
//     addToSummary(visits, "EngineerVisits");

//     return res.json({ success: true, summary });
//   } catch (err) {
//     console.error("❌ reportSummary error:", err);
//     return res.status(500).json({ success: false, error: err.message });
//   }
// };

// module.exports = { reportSummary };


const { getReportsFromS3 } = require("../S3Bucket/s3ElectricalReport");
const MechanicalReport = require("../models/MechanicalReport");
const ServiceReport = require("../models/ServiceReport");
const SafetyReport = require("../models/SafetyReport");
const EngineerVisitReport = require("../models/EngineerVisitReport");

const reportSummary = async (req, res) => {
  try {
    const { month, year } = req.params;
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    // ---------- 1️⃣ ELECTRICAL (from S3) ----------
    const s3Reports = await getReportsFromS3();
    const electricalCounts = {};
    s3Reports.forEach(r => {
      const created = new Date(r.createdAt);
      if (created >= start && created < end && r.userName) {
        electricalCounts[r.userName] = (electricalCounts[r.userName] || 0) + 1;
      }
    });

    // ---------- 2️⃣ MECHANICAL (MongoDB) ----------
    const mechAgg = await MechanicalReport.aggregate([
      { $match: { timestamp: { $gte: start, $lt: end } } },
      { $group: { _id: "$userName", count: { $sum: 1 } } },
    ]);

    // ---------- 3️⃣ SERVICE ----------
    const servAgg = await ServiceReport.aggregate([
      { $match: { reportDate: { $gte: start, $lt: end } } },
      { $group: { _id: "$userName", count: { $sum: 1 } } },
    ]);

    // ---------- 4️⃣ SAFETY ----------
    const safAgg = await SafetyReport.aggregate([
      { $match: { date: { $gte: start, $lt: end } } },
      { $group: { _id: "$customerName", count: { $sum: 1 } } },
    ]);

    // ---------- 5️⃣ ENGINEER VISITS ----------
    const visitAgg = await EngineerVisitReport.aggregate([
      { $match: { date: { $gte: start, $lt: end } } },
      { $group: { _id: "$customerName", count: { $sum: 1 } } },
    ]);

    // ---------- 6️⃣ COMBINE ----------
    const summary = {};

    // Electrical (from S3)
    Object.entries(electricalCounts).forEach(([user, count]) => {
      summary[user] = { ...(summary[user] || {}), EPM: count };
    });

    const addToSummary = (arr, key) => {
      arr.forEach(({ _id, count }) => {
        if (!_id) return;
        summary[_id] = { ...(summary[_id] || {}), [key]: count };
      });
    };

    addToSummary(mechAgg, "MPM");
    addToSummary(servAgg, "Service");
    addToSummary(safAgg, "Safety");
    addToSummary(visitAgg, "EngineerVisits");

    res.json({ success: true, summary });
  } catch (err) {
    console.error("❌ Error in reportSummary:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = { reportSummary };
