


const ServiceReport = require('../models/ServiceReport');



/**
 * Normalize a field that may arrive as:
 *   - undefined
 *   - single string
 *   - array of strings
 */
function toArray(val) {
  if (val == null) return [];
  return Array.isArray(val) ? val : [val];
}

/** Safely JSON.parse, returning {} on error */
function safeJsonParse(objStr, fallback = {}) {
  try {
    if (!objStr || typeof objStr !== 'string') return fallback;
    return JSON.parse(objStr);
  } catch (_) {
    return fallback;
  }
}

/** Extract S3 URLs from a multer field array */
function extractUrls(fieldArray) {
  if (!Array.isArray(fieldArray)) return [];
  // If your uploader stores at file.path or file.key, adjust here.
  return fieldArray
    .map(f => f?.location || f?.path || '')
    .filter(Boolean);
}

/** Get month range [start, end) for a Date */
function monthRange(d = new Date()) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0);
  return { start, end };
}


/* utils */
function toArray(val) {
  if (val == null) return [];
  return Array.isArray(val) ? val : [val];
}
function safeJsonParse(objStr, fallback = {}) {
  try { return objStr && typeof objStr === 'string' ? JSON.parse(objStr) : fallback; }
  catch { return fallback; }
}
function siteCode(src) {
  return (src || 'SITE').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'SITE';
}

/**
 * GET /api/service-reports/next-seq?fy=24-25&site=PTP - VALDEL
 * Returns the next series number like PTPVAL/SR/24-25/001
 * Simple count-based approach (good enough; avoids extra model).
 */
exports.getNextServiceReportSeq = async (req, res) => {
  try {
    const fy = (req.query.fy || '').trim();        // e.g. "24-25"
    const site = (req.query.site || '').trim();    // e.g. "PTP - VALDEL"
    if (!fy) return res.status(400).json({ success: false, message: 'Missing fy' });
    const prefix = `${siteCode(site)}/SR/${fy}/`;

    const count = await ServiceReport.countDocuments({ 'header.reportNo': { $regex: `^${prefix}\\d+$` } });
    const next = String(count + 1).padStart(3, '0');
    return res.json({ success: true, reportNo: `${prefix}${next}` });
  } catch (err) {
    console.error('next-seq error:', err);
    return res.status(500).json({ success: false, message: 'Failed to compute next sequence' });
  }
};

exports.createServiceReport = async (req, res) => {
  try {
    const {
      equipmentId,
      equipmentName,
      userName,
      technicianName,
      technicianEmail,

      submittedByRole,
      submittedByName,
      submittedByEmail,
      submittedById,

      equipmentDetails,
      detailsOfServiceDone,
      equipmentWorkingStatus,
      suggestionsFromEngineer,
      customerRemarks,
      classificationCode,
      customerSignoffText,
      technicianSignatureText,

      issueReported,
      issueDescription,
      actionTaken,
      sparesUsed,
      isResolved,

      // Header fields coming from FE (note: Plant Capacity, no "Analyzed by")
      headerSite,
      headerDate,
      headerReportNo,
      headerPlantCapacity,    // NEW (UI label)
      headerReference,
      headerIncidentDate,
      headerTypeOfService,
      headerPreparedBy,

      customerSigName,
      customerSigDesignation,
      technicianSigName,
      technicianSigDesignation,
    } = req.body;

    if (!userName || !technicianName || !technicianEmail) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: userName, technicianName, technicianEmail.",
      });
    }

    const role = submittedByRole === 'TerritorialManager' ? 'TerritorialManager' : 'Technician';
    const submittedBy = {
      userId: submittedById || undefined,
      role,
      name: submittedByName || technicianName,
      email: submittedByEmail || technicianEmail,
    };
    const technician = { name: technicianName, email: technicianEmail };

    // FILES via multer.fields
    const bag = req.files || {};
    const getLoc = (arr) => (Array.isArray(arr) ? arr.map(f => f?.location || f?.path).filter(Boolean) : []);
    const generalPhotoUrls = getLoc(bag.photos);
    const issuePhotoUrls = getLoc(bag.issuePhotos);
    const beforeUrls = getLoc(bag.beforeImages);
    const afterUrls = getLoc(bag.afterImages);

    // NEW: signature images
    const customerSignatureImageUrl = bag.customerSignatureImage?.[0]?.location || null;
    const technicianSignatureImageUrl = bag.technicianSignatureImage?.[0]?.location || null;

    // Captions: support both beforeCaptions[] and beforeCaptions
    const beforeCaps = toArray(
      req.body['beforeCaptions[]'] != null ? req.body['beforeCaptions[]'] : req.body.beforeCaptions
    );
    const afterCaps = toArray(
      req.body['afterCaptions[]'] != null ? req.body['afterCaptions[]'] : req.body.afterCaptions
    );

    const equipmentDetailsObj = safeJsonParse(equipmentDetails, {});
    const effectiveEquipmentName = equipmentName || equipmentDetailsObj?.name || "";
    // Header: set plantCapacity; mirror into legacy areaOfInspection for compatibility
    const header = {
      site: headerSite || '',
      date: headerDate ? new Date(headerDate) : undefined,
      reportNo: headerReportNo || '',
      plantCapacity: headerPlantCapacity || '',
      areaOfInspection: headerPlantCapacity || '', // legacy mirror
      reference: headerReference || '',
      incidentDate: headerIncidentDate || '',
      typeOfService: headerTypeOfService || '',
      // analyzedBy: intentionally omitted
      preparedBy: headerPreparedBy || '',
    };

    // Upsert “this month”
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const monthlyWhere = { reportDate: { $gte: startOfMonth, $lte: endOfMonth } };
    if (equipmentId) {
      monthlyWhere.equipmentId = equipmentId;
    } else {
      // No equipment: de-duplicate by user + site (header.site)
      monthlyWhere.userName = userName;
      if (header.site) monthlyWhere['header.site'] = header.site;
    }
    const existing = await ServiceReport.findOne(monthlyWhere);
    if (existing) {
      existing.equipmentName = effectiveEquipmentName;
      existing.userName = userName;
      existing.technician = technician;
      existing.submittedBy = submittedBy;
      existing.submittedAt = new Date();

      existing.customerSigName = customerSigName || existing.customerSigName;
      existing.customerSigDesignation = customerSigDesignation || existing.customerSigDesignation;
      existing.technicianSigName = technicianSigName || existing.technicianSigName;
      existing.technicianSigDesignation = technicianSigDesignation || existing.technicianSigDesignation;


      existing.header = { ...(existing.header || {}), ...header };

      existing.equipmentDetails = equipmentDetailsObj;
      if (typeof detailsOfServiceDone === 'string') existing.detailsOfServiceDone = detailsOfServiceDone;
      if (typeof equipmentWorkingStatus === 'string') existing.equipmentWorkingStatus = equipmentWorkingStatus;
      if (typeof suggestionsFromEngineer === 'string') existing.suggestionsFromEngineer = suggestionsFromEngineer;
      if (typeof customerRemarks === 'string') existing.customerRemarks = customerRemarks;
      if (typeof classificationCode === 'string') existing.classificationCode = classificationCode;
      if (typeof customerSignoffText === 'string') existing.customerSignoffText = customerSignoffText;
      if (typeof technicianSignatureText === 'string') existing.technicianSignatureText = technicianSignatureText;
      if (typeof issueReported === 'string') existing.issueReported = issueReported;

      // NEW: signature images
      if (customerSignatureImageUrl) existing.customerSignatureImageUrl = customerSignatureImageUrl;
      if (technicianSignatureImageUrl) existing.technicianSignatureImageUrl = technicianSignatureImageUrl;

      if (generalPhotoUrls.length) existing.photos = [...(existing.photos || []), ...generalPhotoUrls];
      if (issuePhotoUrls.length) existing.issuePhotos = [...(existing.issuePhotos || []), ...issuePhotoUrls];

      if (beforeUrls.length) {
        existing.beforeImages = [...(existing.beforeImages || []), ...beforeUrls];
        const pads = Array(Math.max(0, beforeUrls.length - beforeCaps.length)).fill('');
        existing.beforeCaptions = [
          ...(existing.beforeCaptions || []),
          ...beforeCaps.slice(0, beforeUrls.length),
          ...pads
        ];
      }
      if (afterUrls.length) {
        existing.afterImages = [...(existing.afterImages || []), ...afterUrls];
        const pads = Array(Math.max(0, afterUrls.length - afterCaps.length)).fill('');
        existing.afterCaptions = [
          ...(existing.afterCaptions || []),
          ...afterCaps.slice(0, afterUrls.length),
          ...pads
        ];
      }

      // legacy
      if (issueDescription !== undefined) existing.issueDescription = issueDescription;
      if (actionTaken !== undefined) existing.actionTaken = actionTaken;
      if (sparesUsed !== undefined) existing.sparesUsed = sparesUsed;
      if (isResolved !== undefined) existing.isResolved = isResolved === 'true';

      await existing.save();
      return res.json({ success: true, message: 'Service Report updated for current month.', report: existing });
    }

    const report = new ServiceReport({
      equipmentId,
      equipmentName: effectiveEquipmentName,
      userName,
      technician,
      submittedBy,
      submittedAt: new Date(),

      header,

      equipmentDetails: equipmentDetailsObj,
      detailsOfServiceDone: detailsOfServiceDone || '',
      equipmentWorkingStatus: equipmentWorkingStatus || 'Normal conditions',
      suggestionsFromEngineer: suggestionsFromEngineer || '',
      customerRemarks: customerRemarks || '',
      classificationCode: classificationCode || '',
      customerSignoffText: customerSignoffText || '',
      technicianSignatureText: technicianSignatureText || '',

      // NEW: signature image URLs
      customerSignatureImageUrl,
      technicianSignatureImageUrl,

      customerSigName,
      customerSigDesignation,
      technicianSigName,
      technicianSigDesignation,

      issueReported: issueReported || '',
      issuePhotos: issuePhotoUrls,
      beforeImages: beforeUrls,
      beforeCaptions: beforeUrls.length ? beforeCaps.slice(0, beforeUrls.length) : [],
      afterImages: afterUrls,
      afterCaptions: afterUrls.length ? afterCaps.slice(0, afterUrls.length) : [],

      photos: generalPhotoUrls,

      // legacy
      issueDescription,
      actionTaken,
      sparesUsed,
      isResolved: isResolved === 'true',

      reportDate: new Date(),
    });

    await report.save();
    return res.json({ success: true, message: 'Service Report created.', report });
  } catch (err) {
    console.error('🔴 ServiceReport create error:', err);
    return res.status(500).json({ success: false, message: 'Server error processing service report' });
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


