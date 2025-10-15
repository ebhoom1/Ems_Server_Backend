// routes/electricalReportRoutes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/electricalReportController');

// 1) Create a new electrical report
router.post('/add-electricalreport', ctrl.createReport);

// 2) Get one report (by equipmentId)
router.get('/get-electricalreport/:equipmentId', ctrl.getReportByEquipment);

// 3) Get all reports
router.get('/all-electricalreports', ctrl.getAllReports);

// 4) Delete a report by ID
router.delete('/delete-electricalreport/:id', ctrl.deleteReport);

// 5) Get reports by month (YYYY/MM)
router.get('/electricalreports/month/:year/:month', ctrl.getReportsByMonth);

// 6) (Optional) Get reports by “userName” + month (if you store userName in Equipment or elsewhere)
router.get(
  '/electricalreports/user/:userName/:year/:month',
  ctrl.getReportsByUserMonth
);

// after your other routes
router.get(
  '/electricalreport/exists/:equipmentId',
  ctrl.reportExists
);

router.get(
  '/electricalreport/equipment/:equipmentId', // equipmentId from params
  ctrl.getReportByEquipmentAndMonth // year and month from query parameters
);

router.delete("/s3/electrical/delete", async (req, res) => {
  try {
    const { userName, equipment } = req.body;

    if (!userName ) {
      return res.status(400).json({
        success: false,
        message: "userName and date are required (format: YYYY-MM-DD)",
      });
    }

    // Pass 'equipment' instead of 'equipmentId'
    const result = await deleteReportsFromS3({ userName,equipment });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "No matching reports found for deletion",
      });
    }

    res.json({
      success: true,
      message: `${result.deletedCount} report(s) deleted successfully.`,
    });
  } catch (err) {
    console.error("❌ Error deleting report:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});


module.exports = router;