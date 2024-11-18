const express = require('express');
const router = express.Router();
const { 
  getDifferenceDataByUserNameAndInterval, 
  getAllDifferenceDataByUserName,
  getDifferenceDataByTimeRange,
  downloadDifferenceData
} = require('../controllers/differenceData');

// Helper function to validate intervals
const isValidInterval = (interval) => ['daily', 'hourly'].includes(interval);

// Route to get difference data by userName and interval (daily/hourly) with pagination
router.get('/difference/:userName', async (req, res) => {
  const { userName } = req.params;
  const { interval, page = 1, limit = 100 } = req.query;

  try {
    if (!isValidInterval(interval)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid interval. Use "daily" or "hourly".'
      });
    }

    const data = await getDifferenceDataByUserNameAndInterval(userName, interval, parseInt(page), parseInt(limit));

    if (!data.data.length) {
      return res.status(404).json({
        success: false,
        message: `No ${interval} difference data found for user ${userName}.`
      });
    }

    res.status(200).json({
      success: true,
      message: `${interval} difference data for ${userName} fetched successfully.`,
      data: data.data,
      total: data.total,
      page: data.page,
      limit: data.limit
    });
  } catch (error) {
    console.error('Error fetching difference data:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error.',
      error: error.message
    });
  }
});

// Route to get all difference data (both hourly and daily) by userName with pagination
router.get('/differenceByUserName/:userName', async (req, res) => {
  const { userName } = req.params;
  const { interval, page = 1, limit = 100 } = req.query;

  try {
    if (interval && !isValidInterval(interval)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid interval. Use "daily" or "hourly".'
      });
    }

    const data = await getAllDifferenceDataByUserName(userName, interval, parseInt(page), parseInt(limit));

    if (!data.data.length) {
      return res.status(404).json({
        success: false,
        message: `No difference data found for user ${userName}.`
      });
    }

    res.status(200).json({
      success: true,
      message: `All difference data for ${userName} fetched successfully.`,
      data: data.data,
      total: data.total,
      page: data.page,
      totalPages: data.totalPages
    });
  } catch (error) {
    console.error('Error fetching all difference data:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error.',
      error: error.message
    });
  }
});

  // Route to fetch data by userName, interval, and time range with pagination
  router.get('/differenceData/:userName/:interval/:fromDate/:toDate', async (req, res) => {
    const { userName, interval, fromDate, toDate } = req.params;
    const { page = 1, limit = 100 } = req.query;

    try {
        if (!isValidInterval(interval)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid interval. Use "daily" or "hourly".',
            });
        }

        const data = await getDifferenceDataByTimeRange(
            userName,
            interval,
            fromDate,
            toDate,
            parseInt(page),
            parseInt(limit)
        );

        if (!data.data.length) {
            return res.status(404).json({
                success: false,
                message: `No data found for ${userName} within the specified time range.`,
            });
        }

        res.status(200).json({
            success: true,
            message: 'Data fetched successfully.',
            data: data.data,
            total: data.total,
            page: data.page,
            limit: data.limit,
        });
    } catch (error) {
        console.error('Error fetching data by time range:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch data.',
            error: error.message,
        });
    }
});

// **Unified Download Route for CSV and PDF**
// Unified Download Route for CSV and PDF
// Route to download difference data as CSV or PDF
router.get('/downloadDifferenceData/', async (req, res) => {
  const { userName, fromDate, toDate, format, intervalType = 'daily' } = req.query;

  // Validate the required parameters
  if (!userName || !fromDate || !toDate || !['csv', 'pdf'].includes(format)) {
      return res.status(400).json({
          success: false,
          message: 'Missing or invalid query parameters. Use "csv" or "pdf" for format.',
      });
  }

  try {
      // Call the download function with the provided query parameters
      await downloadDifferenceData(req, res);
  } catch (error) {
      console.error('Error downloading data:', error);
      res.status(500).json({ success: false, message: 'Failed to download data.' });
  }
});;


module.exports = router;
