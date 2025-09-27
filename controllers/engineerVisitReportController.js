const EngineerVisitReport = require('../models/EngineerVisitReport');

exports.createEngineerVisitReport = async (req, res) => {
  try {
    const {
      customerName,
      referenceNo, date, engineerName,
      plantCapacity, technology,
      parameters, keyPoints, consumables,
      visitDetails, engineerRemarks, customerRemarks,
      customerSigName, customerSigDesignation,
      engineerSigName, engineerSigDesignation
    } = req.body;

    if ( !customerName || !engineerName) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const customerSig = req.files?.customerSignatureImage?.[0]?.location || "";
    const engineerSig = req.files?.engineerSignatureImage?.[0]?.location || "";

    const report = new EngineerVisitReport({
      
      customerName,
      referenceNo, // ✅ updated
      date,
      engineerName,
      plantCapacity,
      technology,
      parameters: parameters ? JSON.parse(parameters) : {},
      keyPoints: keyPoints ? JSON.parse(keyPoints) : {},
      consumables: consumables ? JSON.parse(consumables) : {},
      visitDetails,
      engineerRemarks,
      customerRemarks,
      customerSignatureImage: customerSig,
      engineerSignatureImage: engineerSig,
      customerSigName,
      customerSigDesignation,
      engineerSigName,
      engineerSigDesignation,
    });

    await report.save();
    res.status(201).json({ success: true, report });
  } catch (err) {
    console.error("Error saving Engineer Visit Report:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getEngineerVisitReportByEquipment = async (req, res) => {
  try {
    const { equipmentId } = req.params;
    const report = await EngineerVisitReport.findOne({ equipmentId }).sort({ createdAt: -1 });
    if (!report) return res.status(404).json({ success: false, message: "No report found" });
    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ success: false, message: "Error fetching report" });
  }
};

// exports.getEngineerVisitReportsByUserAndMonth = async (req, res) => {
//   try {
//     const { userName, year, month } = req.params;

//     const start = new Date(year, month - 1, 1);
//     const end = new Date(year, month, 0, 23, 59, 59);

//     const reports = await EngineerVisitReport.find({
//       customerName: userName,
//       date: { $gte: start, $lte: end },
//     });

//     res.json({ success: true, reports });
//   } catch (err) {
//     console.error("Error fetching engineer visit reports", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

exports.getEngineerVisitReportsByUserAndMonth = async (req, res) => {
  try {
    const { userName, year, month } = req.params;
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    const reports = await EngineerVisitReport.find({
      customerName: new RegExp(`^${userName}$`, "i"),
      date: { $gte: start, $lte: end }
    })
      .select("+customerSignatureImage +engineerSignatureImage") // ✅ force include
      .sort({ date: -1 });

    res.json({ success: true, reports });
  } catch (err) {
    console.error("Error fetching engineer visit reports", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
