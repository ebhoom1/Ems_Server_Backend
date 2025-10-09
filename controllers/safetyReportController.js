

const SafetyReport = require("../models/SafetyReport");

exports.createSafetyReport = async (req, res) => {
  try {
    const {
      customerName,
      refNo, date, plantName, capacity, engineerName,
      checklistType, dynamicChecklist,
      checklist, auditDetails, observation,
      engineerRemarks, customerRemarks,
      customerSigName, customerSigDesignation,
      engineerSigName, engineerSigDesignation
    } = req.body; 
     console.log("req.body:", req.body);
    if (!customerName || !engineerName) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const customerSig = req.files?.customerSignatureImage?.[0]?.location || "";
    const engineerSig = req.files?.engineerSignatureImage?.[0]?.location || "";

    if (req.body.dynamicChecklist) {
      try {
        req.body.dynamicChecklist = JSON.parse(req.body.dynamicChecklist);
      } catch (err) {
        console.warn("⚠️ Failed to parse dynamicChecklist JSON");
      }
    }


    const report = new SafetyReport({
      customerName,
      refNo, date, plantName, capacity, engineerName,
      checklistType,
      dynamicChecklist: dynamicChecklist ? JSON.parse(dynamicChecklist) : {},
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


exports.createSafetyReport = async (req, res) => {
  try {
    const {
      customerName,
      refNo,
      date,
      plantName,
      capacity,
      engineerName,
      checklistType,
      checklist,
      auditDetails,
      observation,
      engineerRemarks,
      customerRemarks,
      customerSigName,
      customerSigDesignation,
      engineerSigName,
      engineerSigDesignation,
    } = req.body;

    // ✅ Parse dynamicChecklist safely
    let dynamicChecklist = {};
    if (req.body.dynamicChecklist) {
      try {
        dynamicChecklist = JSON.parse(req.body.dynamicChecklist);
      } catch (err) {
        console.warn("⚠️ Failed to parse dynamicChecklist JSON:", err.message);
        dynamicChecklist = {};
      }
    }

    // ✅ Parse checklist safely
    let parsedChecklist = {};
    if (checklist) {
      try {
        parsedChecklist = JSON.parse(checklist);
      } catch (err) {
        console.warn("⚠️ Failed to parse checklist JSON:", err.message);
      }
    }

    // ✅ Extract S3 signature URLs
    const customerSig = req.files?.customerSignatureImage?.[0]?.location || "";
    const engineerSig = req.files?.engineerSignatureImage?.[0]?.location || "";

    // ✅ Validate required
    if (!customerName || !engineerName) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    // ✅ Create and save report
    const report = new SafetyReport({
      customerName,
      refNo,
      date,
      plantName,
      capacity,
      engineerName,
      checklistType,
      dynamicChecklist, // ✅ already parsed above
      checklist: parsedChecklist,
      auditDetails,
      observation,
      engineerRemarks,
      customerRemarks,
      customerSigName,
      customerSigDesignation,
      engineerSigName,
      engineerSigDesignation,
      customerSignatureImage: customerSig,
      engineerSignatureImage: engineerSig,
    });

    await report.save();

    return res
      .status(201)
      .json({ success: true, message: "Safety report saved", report });
  } catch (err) {
    console.error("🚨 Error saving Safety Report:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
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
    const { checklistType } = req.query; // ✅ read from query params

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    const filter = {
      customerName: user,
      date: { $gte: start, $lte: end },
    };

    if (checklistType) filter.checklistType = checklistType; // ✅ apply filter if provided

    const reports = await SafetyReport.find(filter).sort({ date: -1 });

    res.json({ success: true, reports });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error fetching reports" });
  }
};

// ✅ UPDATE SAFETY REPORT
// exports.updateSafetyReport = async (req, res) => {
//   try {
//     const { reportId } = req.params;

//     // Include dynamicChecklist, safety fields, etc.
//     const updateFields = { ...req.body };

//     // Handle new signature uploads (optional)
//     if (req.files) {
//       if (req.files.customerSignatureImage?.[0]?.location) {
//         updateFields.customerSignatureImage =
//           req.files.customerSignatureImage[0].location;
//       }
//       if (req.files.engineerSignatureImage?.[0]?.location) {
//         updateFields.engineerSignatureImage =
//           req.files.engineerSignatureImage[0].location;
//       }
//     }

//     const updatedReport = await SafetyReport.findByIdAndUpdate(
//       reportId,
//       { $set: updateFields },
//       { new: true }
//     );

//     if (!updatedReport)
//       return res.status(404).json({ success: false, message: "Report not found" });

//     res.json({ success: true, report: updatedReport });
//   } catch (err) {
//     console.error("❌ Error updating safety report:", err);
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };


// ✅ Update Safety Report (Safe Partial Update)
exports.updateSafetyReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    let report = await SafetyReport.findById(reportId);
    if (!report) return res.status(404).json({ success: false, message: "Report not found" });

    // ✅ Parse JSON fields safely
    const parseField = (field) => {
      try {
        return typeof field === "string" ? JSON.parse(field) : field;
      } catch {
        return field;
      }
    };

    // ✅ Update text fields only if provided
    const updatableFields = [
      "refNo", "date", "customerName", "plantName", "capacity",
      "engineerName", "auditDetails", "observation",
      "customerRemarks", "engineerRemarks",
      "customerSigName", "customerSigDesignation",
      "engineerSigName", "engineerSigDesignation",
      "checklistType"
    ];

    updatableFields.forEach((field) => {
      if (req.body[field] !== undefined && req.body[field] !== null) {
        report[field] = req.body[field];
      }
    });

    // ✅ Checklist (static & dynamic)
    if (req.body.checklist) {
      report.checklist = parseField(req.body.checklist);
    }
    if (req.body.dynamicChecklist) {
      report.dynamicChecklist = parseField(req.body.dynamicChecklist);
    }

    // ✅ Signatures: replace only if new file uploaded
    if (req.files?.customerSignatureImage?.[0]) {
      report.customerSignatureImage = req.files.customerSignatureImage[0].location;
    }

    if (req.files?.engineerSignatureImage?.[0]) {
      report.engineerSignatureImage = req.files.engineerSignatureImage[0].location;
    }

    // ✅ Otherwise, if no new uploads and no explicit change, keep old URLs (no action needed)

    await report.save();

    res.status(200).json({
      success: true,
      message: "Safety Report updated successfully",
      report,
    });
  } catch (err) {
    console.error("❌ updateSafetyReport error:", err);
    res.status(500).json({
      success: false,
      message: "Error updating safety report",
      error: err.message,
    });
  }
};


// ✅ GET SAFETY REPORT BY ID (for Edit Prefill)
exports.getSafetyReportById = async (req, res) => {
  try {
    const { id } = req.params;
    const report = await SafetyReport.findById(id);

    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    res.json({ success: true, report });
  } catch (err) {
    console.error("❌ Error fetching safety report by ID:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};