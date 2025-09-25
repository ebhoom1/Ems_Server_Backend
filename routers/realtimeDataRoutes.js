// routes/realtimeDataRoutes.js
const express = require("express");
const router = express.Router();

const { deleteRealtimeDataFromS3 } = require("../S3Bucket/s3saveRealtimeData");
const { getHourlyConsumptionData, getHourlyConsumptionDataByDate } = require("../S3Bucket/s3HourlyConsumption");

/**
 * @route   DELETE /api/realtimedata
 * @desc    Delete realtime data records by userName and date
 * @access  Public
 */
router.delete("/realtimedata", async (req, res) => {
  const { userName, date } = req.query;

  if (!userName || !date) {
    return res.status(400).json({
      message: "Both 'userName' and 'date' (in YYYY-MM-DD format) are required query parameters.",
    });
  }

  try {
    const result = await deleteRealtimeDataFromS3({ userName, date });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "No matching records found to delete." });
    }

    res.status(200).json({
      message: `Successfully deleted ${result.deletedCount} record(s).`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error in /realtimedata delete route:", error);
    res.status(500).json({ message: "An internal server error occurred." });
  }
});

/**
 * @route   GET /api/hourly
 * @desc    Get hourly consumption data for a user, with optional date range filtering
 * @access  Public
 */
router.get("/hourly", async (req, res) => {
  try {
    const { userName, startDate, endDate } = req.query;

    if (!userName) {
      return res.status(400).json({ msg: "Query parameter 'userName' is required." });
    }

    const data = await getHourlyConsumptionData({
      userName,
      startDate,
      endDate,
    });

    res.status(200).json(data);
  } catch (error) {
    console.error("Error in GET /hourly route:", error);
    res.status(500).json({ msg: "Server error occurred while fetching data." });
  }
});

/**
 * @route   GET /api/hourly-by-date
 * @desc    Get hourly consumption data for a user on a specific date
 * @access  Public
 */
router.get("/hourly-by-date", async (req, res) => {
  try {
    const { userName, date } = req.query;

    if (!userName || !date) {
      return res.status(400).json({
        msg: "Query parameters 'userName' and 'date' (in YYYY-MM-DD format) are required.",
      });
    }

    const data = await getHourlyConsumptionDataByDate({
      userName,
      date,
    });

    if (data.length === 0) {
      return res.status(404).json({
        success: false,
        message: `❌ No data found for user '${userName}' on date '${date}'.`,
      });
    }

    res.status(200).json(data);
  } catch (error) {
    console.error("Error in GET /hourly-by-date route:", error, error.stack);
    res.status(500).json({ msg: "Server error occurred while fetching data." });
  }
});

module.exports = router;