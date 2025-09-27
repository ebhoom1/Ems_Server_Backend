// const SafetyReport = require("../models/SafetyReport");

// exports.createSafetyReport = async (req, res) => {
//   try {
//     const {
//       equipmentId, equipmentName, customerName,
//       refNo, date, plantName, capacity, engineerName,
//       checklist, observation, customerRemarks
//     } = req.body;

//     if (!equipmentId || !equipmentName || !customerName || !engineerName) {
//       return res.status(400).json({ success: false, message: "Missing required fields" });
//     }

//     const photos = (req.files?.photos || []).map(f => f.location || f.path);
//     const customerSig = req.files?.customerSignatureImage?.[0]?.location || "";
//     const engineerSig = req.files?.engineerSignatureImage?.[0]?.location || "";

//     const report = new SafetyReport({
//       equipmentId, equipmentName, customerName,
//       refNo, date, plantName, capacity, engineerName,
//       checklist: checklist ? JSON.parse(checklist) : {},
//       observation, customerRemarks,
//       photos,
//       customerSignatureImage: customerSig,
//       engineerSignatureImage: engineerSig
//     });

//     await report.save();
//     res.status(201).json({ success: true, report });
//   } catch (err) {
//     console.error("Error saving Safety Report:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// exports.getSafetyReportByEquipment = async (req, res) => {
//   try {
//     const { equipmentId } = req.params;
//     const report = await SafetyReport.findOne({ equipmentId }).sort({ createdAt: -1 });
//     if (!report) return res.status(404).json({ success: false, message: "No report found" });
//     res.json({ success: true, report });
//   } catch (err) {
//     res.status(500).json({ success: false, message: "Error fetching report" });
//   }
// };


const SafetyReport = require("../models/SafetyReport");

exports.createSafetyReport = async (req, res) => {
  try {
    const {
       customerName,
      refNo, date, plantName, capacity, engineerName,
      checklist, auditDetails, observation,
      engineerRemarks, customerRemarks,
      customerSigName, customerSigDesignation,
      engineerSigName, engineerSigDesignation
    } = req.body;

    if ( !customerName || !engineerName) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const customerSig = req.files?.customerSignatureImage?.[0]?.location || "";
    const engineerSig = req.files?.engineerSignatureImage?.[0]?.location || "";

    const report = new SafetyReport({
       customerName,
      refNo, date, plantName, capacity, engineerName,
      checklist: checklist ? JSON.parse(checklist) : {},
      auditDetails, observation, engineerRemarks, customerRemarks,
      customerSigName, customerSigDesignation,
      engineerSigName, engineerSigDesignation,
      customerSignatureImage: customerSig,
      engineerSignatureImage: engineerSig,
    });

    await report.save();
    res.status(201).json({ success: true, report });
  } catch (err) {
    console.error("Error saving Safety Report:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};



exports.getSafetyReportByEquipment = async (req, res) => {
  try {
    const { equipmentId } = req.params;
    const report = await SafetyReport.findOne({ equipmentId }).sort({ createdAt: -1 });
    if (!report) return res.status(404).json({ success: false, message: "No report found" });
    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error fetching report" });
  }
};

exports.getReportsByUserMonth = async (req, res) => {
  try {
    const { user, year, month } = req.params;
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    const reports = await SafetyReport.find({
      customerName: user,
      date: { $gte: start, $lte: end }
    }).sort({ date: -1 });

    res.json({ success: true, reports });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error fetching reports" });
  }
};


