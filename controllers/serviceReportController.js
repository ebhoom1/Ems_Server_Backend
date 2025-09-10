const ServiceReport = require('../models/ServiceReport');

// controllers/serviceReportController.js
// exports.createServiceReport = async (req, res) => {
//   console.log(
//     "--- multer files for ServiceReport (general photos):",
//     req.files
//   );
//   console.log("--- form fields for ServiceReport:", req.body);

//   try {
//     const {
//       equipmentId,
//       equipmentName,
//       userName, // This now comes from the editable customerNameInput
//       technicianName,
//       technicianEmail,
//       equipmentDetails, // This is a JSON string, which might be 'null' or '{}' if not provided
//       detailsOfServiceDone,
//       equipmentWorkingStatus,
//       suggestionsFromEngineer,
//       customerRemarks,
//       classificationCode,
//       customerSignoffText,
//       technicianSignatureText,
//       issueDescription, // Keeping for compatibility, but can be removed if not used
//       actionTaken, // Keeping for compatibility, but can be removed if not used
//       sparesUsed, // Keeping for compatibility, but can be removed if not used
//       isResolved, // Keeping for compatibility, but can be removed if not used
//     } = req.body;

//     // UPDATED VALIDATION: Only check for absolutely essential fields that identify the report
//     // Other fields will be saved as empty strings if not provided.
//     if (
//       !equipmentId ||
//       !equipmentName ||
//       !userName ||
//       !technicianName ||
//       !technicianEmail
//     ) {
//       return res
//         .status(400)
//         .json({
//           success: false,
//           message:
//             "Missing essential identifying information for Service Report (Equipment, User, Technician).",
//         });
//     }

//     const technician = { name: technicianName, email: technicianEmail };
//     const newPhotoUrls = (req.files || []).map((file) => file.location);

//     const currentDate = new Date();
//     const currentYear = currentDate.getFullYear();
//     const currentMonth = currentDate.getMonth() + 1;
//     const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
//     const endOfMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59);

//     let existingReport = await ServiceReport.findOne({
//       equipmentId,
//       reportDate: { $gte: startOfMonth, $lte: endOfMonth },
//     });

//     let report;
//     if (existingReport) {
//       // Update existing report
//       existingReport.equipmentName = equipmentName;
//       existingReport.userName = userName;
//       existingReport.technician = technician;
//       // Parse equipmentDetails, providing an empty object as fallback
//       existingReport.equipmentDetails = JSON.parse(equipmentDetails || "{}");
//       existingReport.detailsOfServiceDone = detailsOfServiceDone || ""; // Allow empty
//       existingReport.equipmentWorkingStatus =
//         equipmentWorkingStatus || "Normal conditions"; // Allow empty, default to 'Normal conditions'
//       existingReport.suggestionsFromEngineer = suggestionsFromEngineer || ""; // Allow empty
//       existingReport.customerRemarks = customerRemarks || ""; // Allow empty
//       existingReport.classificationCode = classificationCode || ""; // Allow empty
//       existingReport.customerSignoffText = customerSignoffText || ""; // Allow empty
//       existingReport.technicianSignatureText = technicianSignatureText || ""; // Allow empty

//       // Update optional fields if they are sent and not undefined
//       if (issueDescription !== undefined)
//         existingReport.issueDescription = issueDescription;
//       if (actionTaken !== undefined) existingReport.actionTaken = actionTaken;
//       if (sparesUsed !== undefined) existingReport.sparesUsed = sparesUsed;
//       if (isResolved !== undefined)
//         existingReport.isResolved = isResolved === "true";

//       existingReport.photos = [...existingReport.photos, ...newPhotoUrls]; // Append new general photos

//       report = await existingReport.save();
//       console.log("Service report updated successfully:", report._id);
//     } else {
//       // Create a new report
//       report = new ServiceReport({
//         equipmentId,
//         equipmentName,
//         userName,
//         technician,
//         equipmentDetails: JSON.parse(equipmentDetails || "{}"),
//         detailsOfServiceDone: detailsOfServiceDone || "",
//         equipmentWorkingStatus: equipmentWorkingStatus || "Normal conditions",
//         suggestionsFromEngineer: suggestionsFromEngineer || "",
//         customerRemarks: customerRemarks || "",
//         classificationCode: classificationCode || "",
//         customerSignoffText: customerSignoffText || "",
//         technicianSignatureText: technicianSignatureText || "",
//         issueDescription: issueDescription,
//         actionTaken: actionTaken,
//         sparesUsed: sparesUsed,
//         isResolved: isResolved === "true",
//         photos: newPhotoUrls,
//         reportDate: new Date(),
//       });
//       await report.save();
//       console.log("Service Report created successfully:", report._id);
//     }

//     res
//       .status(201)
//       .json({
//         success: true,
//         message: "Service Report processed successfully",
//         report,
//       });
//   } catch (err) {
//     console.error(
//       "🔴 Error creating/updating Service Report:",
//       err.stack || err
//     );
//     res
//       .status(500)
//       .json({
//         success: false,
//         message: "Server error processing service report",
//       });
//   }
// };

// controllers/serviceReportController.js
exports.createServiceReport = async (req, res) => {
  console.log("--- multer files for ServiceReport (general photos):", req.files);
  console.log("--- form fields for ServiceReport:", req.body);

  try {
    const {
      equipmentId,
      equipmentName,
      userName,
      technicianName,
      technicianEmail,

      // NEW: who submitted (from frontend userData)
      submittedByRole,     // 'Technician' | 'TerritorialManager'
      submittedByName,
      submittedByEmail,
      submittedById,       // optional (Mongo ObjectId string)

      equipmentDetails,
      detailsOfServiceDone,
      equipmentWorkingStatus,
      suggestionsFromEngineer,
      customerRemarks,
      classificationCode,
      customerSignoffText,
      technicianSignatureText,
      issueDescription,
      actionTaken,
      sparesUsed,
      isResolved,
    } = req.body;

    if (!equipmentId || !equipmentName || !userName || !technicianName || !technicianEmail) {
      return res.status(400).json({
        success: false,
        message: "Missing essential identifying information for Service Report (Equipment, User, Technician).",
      });
    }

    // Ensure submitter payload is valid; fallback to technician fields
    const role = submittedByRole === 'TerritorialManager' ? 'TerritorialManager' : 'Technician';
    const submittedBy = {
      userId: submittedById || undefined,
      role,
      name: submittedByName || technicianName,
      email: submittedByEmail || technicianEmail,
    };

    const technician = { name: technicianName, email: technicianEmail };
    const newPhotoUrls = (req.files || []).map((file) => file.location);

    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59);

    let existingReport = await ServiceReport.findOne({
      equipmentId,
      reportDate: { $gte: startOfMonth, $lte: endOfMonth },
    });

    let report;
    if (existingReport) {
      existingReport.equipmentName = equipmentName;
      existingReport.userName = userName;

      // keep legacy field in sync
      existingReport.technician = technician;

      // NEW: capture who submitted this update
      existingReport.submittedBy = submittedBy;
      existingReport.submittedAt = new Date();

      existingReport.equipmentDetails = JSON.parse(equipmentDetails || "{}");
      existingReport.detailsOfServiceDone = detailsOfServiceDone || "";
      existingReport.equipmentWorkingStatus = equipmentWorkingStatus || "Normal conditions";
      existingReport.suggestionsFromEngineer = suggestionsFromEngineer || "";
      existingReport.customerRemarks = customerRemarks || "";
      existingReport.classificationCode = classificationCode || "";
      existingReport.customerSignoffText = customerSignoffText || "";
      existingReport.technicianSignatureText = technicianSignatureText || "";

      if (issueDescription !== undefined) existingReport.issueDescription = issueDescription;
      if (actionTaken !== undefined) existingReport.actionTaken = actionTaken;
      if (sparesUsed !== undefined) existingReport.sparesUsed = sparesUsed;
      if (isResolved !== undefined) existingReport.isResolved = isResolved === "true";

      existingReport.photos = [...existingReport.photos, ...newPhotoUrls];

      report = await existingReport.save();
      console.log("Service report updated successfully:", report._id);
    } else {
      report = new ServiceReport({
        equipmentId,
        equipmentName,
        userName,

        // legacy but required
        technician,

        // NEW
        submittedBy,
        submittedAt: new Date(),

        equipmentDetails: JSON.parse(equipmentDetails || "{}"),
        detailsOfServiceDone: detailsOfServiceDone || "",
        equipmentWorkingStatus: equipmentWorkingStatus || "Normal conditions",
        suggestionsFromEngineer: suggestionsFromEngineer || "",
        customerRemarks: customerRemarks || "",
        classificationCode: classificationCode || "",
        customerSignoffText: customerSignoffText || "",
        technicianSignatureText: technicianSignatureText || "",
        issueDescription,
        actionTaken,
        sparesUsed,
        isResolved: isResolved === "true",
        photos: newPhotoUrls,
        reportDate: new Date(),
      });
      await report.save();
      console.log("Service Report created successfully:", report._id);
    }

    return res.status(201).json({
      success: true,
      message: "Service Report processed successfully",
      report,
    });
  } catch (err) {
    console.error("🔴 Error creating/updating Service Report:", err.stack || err);
    return res.status(500).json({
      success: false,
      message: "Server error processing service report",
    });
  }
};


// No changes needed for the following functions, as they fetch existing data
exports.getServiceReportsByEquipmentAndMonth = async (req, res) => {
  try {
    const { equipmentId } = req.params;
    const { year, month } = req.query;

    if (!year || !month) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Year and month query parameters are required.",
        });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const reports = await ServiceReport.find({
      equipmentId: equipmentId,
      reportDate: { $gte: startDate, $lte: endDate },
    }).sort({ reportDate: -1 });

    if (!reports || reports.length === 0) {
      return res
        .status(404)
        .json({
          success: false,
          message: "No Service Reports found for this equipment and month.",
        });
    }
    res.json({ success: true, reports });
  } catch (err) {
    console.error("Error in getServiceReportsByEquipmentAndMonth:", err);
    res
      .status(500)
      .json({
        success: false,
        message: "Server error fetching service reports.",
      });
  }
};

exports.checkServiceReportExists = async (req, res) => {
  try {
    const { equipmentId } = req.params;
    const { year, month } = req.query;

    if (!year || !month) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Year and month query parameters are required.",
        });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const report = await ServiceReport.findOne({
      equipmentId: equipmentId,
      reportDate: { $gte: startDate, $lte: endDate },
    });

    return res.json({ success: true, exists: !!report });
  } catch (err) {
    console.error("Error in checkServiceReportExists:", err);
    res
      .status(500)
      .json({
        success: false,
        message: "Server error checking service report existence.",
      });
  }
};

exports.getReportsByUserAndMonth = async (req, res) => {
  try {
    const { userName, year, month } = req.params;
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);

    if (isNaN(y) || isNaN(m) || m < 1 || m > 12) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid year or month" });
    }

    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);

    const reports = await ServiceReport.find({
      userName: userName,
      reportDate: { $gte: start, $lt: end },
    }).sort({ reportDate: -1 });

    if (!reports.length) {
      return res.json({
        success: false,
        message: "No service reports found for this user.",
      });
    }
    res.json({ success: true, reports });
  } catch (err) {
    console.error("Error in getReportsByUserAndMonth:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};