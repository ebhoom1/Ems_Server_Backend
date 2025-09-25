// In your router file (e.g., routes.js)
const express = require('express');
const router = express.Router();
const { deleteReportsFromS3 } = require('../S3Bucket/s3ElectricalReport'); // Adjust path if necessary

/**
 * @route   DELETE /api/reports
 * @desc    Delete electrical reports by userName, date, and optional equipmentId
 * @access  Public
 * @query   userName (string, required)
 * @query   date (string, required, format: YYYY-MM-DD)
 * @query   equipmentId (string, optional)
 */
router.delete('/reports', async (req, res) => {
  const { userName, date, equipmentId } = req.query;

  // Basic validation to ensure required parameters are present
  if (!userName || !date) {
    return res.status(400).json({ 
      message: "Query parameters 'userName' and 'date' (YYYY-MM-DD) are required." 
    });
  }

  try {
    const result = await deleteReportsFromS3({ userName, date, equipmentId });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "No matching reports found to delete." });
    }

    res.json({ 
      message: `Successfully deleted ${result.deletedCount} report(s).`,
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error('Error deleting reports from S3:', error);
    res.status(500).json({ message: 'Failed to delete reports.' });
  }
});

module.exports = router;