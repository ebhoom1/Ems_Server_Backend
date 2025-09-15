const EngineerVisitReport = require('../models/EngineerVisitReport');

exports.createEngineerVisitReport = async (req, res) => {
  try {
    const {
      equipmentId, equipmentName, customerName,
      referenceNo, date, engineerName,
      plantCapacity, technology,
      parameters, keyPoints, consumables,
      visitDetails, engineerRemarks, customerRemarks,
      customerSigName, customerSigDesignation,
      engineerSigName, engineerSigDesignation
    } = req.body;

    if (!equipmentId || !equipmentName || !customerName || !engineerName) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const customerSig = req.files?.customerSignatureImage?.[0]?.location || "";
    const engineerSig = req.files?.engineerSignatureImage?.[0]?.location || "";

    const report = new EngineerVisitReport({
      equipmentId,
      equipmentName,
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
