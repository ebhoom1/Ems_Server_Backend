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

// ADD THIS near other exports
exports.getEngineerVisitReportById = async (req, res) => {
  try {
    const { id } = req.params;
    const report = await EngineerVisitReport.findById(id);
    if (!report) return res.status(404).json({ success: false, message: "Report not found" });
    res.json({ success: true, report });
  } catch (err) {
    console.error("Error fetching report by id", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ADD THIS near other exports
exports.updateEngineerVisitReport = async (req, res) => {
  try {
    const { id } = req.params;

    // Build a minimal $set only for provided fields
    const set = {};
    const assignIfPresent = (key, value) => {
      if (value !== undefined && value !== null && value !== "") set[key] = value;
    };

    const body = req.body || {};
    // simple fields
    assignIfPresent("customerName", body.customerName);
    assignIfPresent("referenceNo", body.referenceNo);
    assignIfPresent("date", body.date);
    assignIfPresent("engineerName", body.engineerName);
    assignIfPresent("plantCapacity", body.plantCapacity);
    assignIfPresent("technology", body.technology);
    assignIfPresent("visitDetails", body.visitDetails);
    assignIfPresent("engineerRemarks", body.engineerRemarks);
    assignIfPresent("customerRemarks", body.customerRemarks);
    assignIfPresent("customerSigName", body.customerSigName);
    assignIfPresent("customerSigDesignation", body.customerSigDesignation);
    assignIfPresent("engineerSigName", body.engineerSigName);
    assignIfPresent("engineerSigDesignation", body.engineerSigDesignation);

    // nested JSON (if provided, they come as strings)
    if (body.parameters) {
      try { set["parameters"] = JSON.parse(body.parameters); } catch {}
    }
    if (body.keyPoints) {
      try { set["keyPoints"] = JSON.parse(body.keyPoints); } catch {}
    }
    if (body.consumables) {
      try { set["consumables"] = JSON.parse(body.consumables); } catch {}
    }

    // optional new images via multer
    const customerSigLoc = req?.files?.customerSignatureImage?.[0]?.location;
    const engineerSigLoc = req?.files?.engineerSignatureImage?.[0]?.location;
    if (customerSigLoc) set["customerSignatureImage"] = customerSigLoc;
    if (engineerSigLoc) set["engineerSignatureImage"] = engineerSigLoc;

    if (Object.keys(set).length === 0) {
      // nothing to update
      return res.json({ success: true, report: await EngineerVisitReport.findById(id) });
    }

    const updated = await EngineerVisitReport.findByIdAndUpdate(
      id,
      { $set: set },
      { new: true }
    );

    if (!updated) return res.status(404).json({ success: false, message: "Report not found" });
    res.json({ success: true, report: updated });
  } catch (err) {
    console.error("Error updating Engineer Visit Report:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

