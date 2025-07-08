const express = require('express');
const router = express.Router();
const { 
  getDifferenceDataByUserNameAndInterval, 
  getAllDifferenceDataByUserName,
  getDifferenceDataByTimeRange,
  getLastDataByDateRange,
  downloadDifferenceData,
  getTodayDifferenceData,
  getEnergyAndFlowDataByDateRange, 
  getYesterdayDifferenceData ,
  getLastCumulativeFlowOfMonth ,
  getLastCumulativeFlowForUser,
  getLastCumulativeFlowByMonth,
  getDifferenceDataForCurrentMonth,
  getFirstDayMonthlyDifferenceData,
  getTotalCumulatingFlowDifferenceByUser,
  getTotalCumulatingFlowDifferenceByUserAndStack,
  getDifferenceDataLastNDays,
  getFirstCumulativeFlowOfMonth,
  getLastCumulativeFlowsForUserMonth,addManualDifferenceData,getDifferenceReport,
  getDifferenceDataByMonth,getTotalCumulatingFlowDifferenceByUserAndMonth

} = require('../controllers/differenceData');

// Helper function to validate intervals
const isValidInterval = (interval) => ['daily', 'hourly'].includes(interval);
// Route to manually add difference data to S3
router.post('/manual', async (req, res) => {
  try {
    await addManualDifferenceData(req, res);
  } catch (error) {
    console.error('Error in manual difference data route:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

router.get(
  '/difference/total-by-month',
  getTotalCumulatingFlowDifferenceByUserAndMonth
);


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
// Route to get today's difference data for a specific userName
router.get('/differenceData/today/:userName', async (req, res) => {
  const { userName } = req.params;

  if (!userName) {
    return res.status(400).json({
      success: false,
      message: 'userName is required.',
    });
  }

  try {
    // Call the controller function
    const todayData = await getTodayDifferenceData({ query: { userName } }, res);
    return todayData;
  } catch (error) {
    console.error('Error fetching today\'s difference data:', error);
    res.status(500).json({
      success: false,
      message: 'Internal Server Error',
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

// Route to fetch the last data for each date in the given range
router.get('/lastDataByDateRange/:userName/:interval/:fromDate/:toDate', async (req, res) => {
  const { userName, interval, fromDate, toDate } = req.params;

  try {
      if (!isValidInterval(interval)) {
          return res.status(400).json({
              success: false,
              message: 'Invalid interval. Use "daily" or "hourly".',
          });
      }

      const data = await getLastDataByDateRange(userName, interval, fromDate, toDate);

      if (!data.data.length) {
          return res.status(404).json({
              success: false,
              message: `No data found for ${userName} within the specified date range.`,
          });
      }

      res.status(200).json({
          success: true,
          message: 'Last data for each date fetched successfully.',
          data: data.data,
      });
  } catch (error) {
      console.error('Error fetching last data by date range:', error);
      res.status(500).json({
          success: false,
          message: 'Failed to fetch last data for each date.',
          error: error.message,
      });
  }
});

// Route to get energy and flow data by userName and date range
router.get('/energyAndFlowData/:userName/:fromDate/:toDate', async (req, res) => {
  const { userName, fromDate, toDate } = req.params;

  try {
      const data = await getEnergyAndFlowDataByDateRange(userName, fromDate, toDate);

      if (!data.data.length) {
          return res.status(404).json({
              success: false,
              message: `No energy and flow data found for ${userName} within the specified date range.`,
          });
      }

      res.status(200).json({
          success: true,
          message: 'Energy and flow data fetched successfully.',
          data: data.data,
      });
  } catch (error) {
      console.error('Error fetching energy and flow data:', error);
      res.status(500).json({
          success: false,
          message: 'Failed to fetch energy and flow data.',
          error: error.message,
      });
  }
});
// Route to get yesterday's difference data for a specific userName
// Route to get yesterday's difference data for a specific userName
router.get('/differenceData/yesterday/:userName', async (req, res) => {
  const { userName } = req.params;

  if (!userName) {
      return res.status(400).json({
          success: false,
          message: "userName is required.",
      });
  }

  try {
      // Call the updated controller function
      const yesterdayData = await getYesterdayDifferenceData(userName);

      if (yesterdayData.length === 0) {
          return res.status(200).json({
              success: true,
              message: `No data available for ${userName} on yesterday.`,
              data: [],
          });
      }

      res.status(200).json({
          success: true,
          message: `Yesterday's difference data for ${userName} fetched successfully.`,
          data: yesterdayData,
      });
  } catch (error) {
      console.error("Error fetching yesterday's difference data:", error);

      res.status(500).json({
          success: false,
          message: "Internal Server Error",
          error: error.message,
      });
  }
});

router.get("/cumulative-flow/stack/:userName/:stackName/:month", getLastCumulativeFlowOfMonth);

// Bar Chart Endpoint (user-level, all stacks)
// Example: GET /api/cumulative-flow/user/HH014/1?year=2025
router.get("/cumulative-flow/user/:userName/:month", getLastCumulativeFlowForUser);
router.get("/cumulative-flow/:userName/:month", getLastCumulativeFlowByMonth);
router.get('/difference-data/current-month', getDifferenceDataForCurrentMonth);
router.get('/first-day-monthly-difference', getFirstDayMonthlyDifferenceData);
//total
router.get('/total-cumulating-flow', getTotalCumulatingFlowDifferenceByUser);

// Route to get total cumulating flow difference for a specific stack.
// Example call: GET /api/difference-data/total-cumulating-flow/HH014/STP%20inlet
// Here, userName is passed as part of the URL parameters along with stackName.
router.get('/total-cumulating-flow/:userName/:stackName', getTotalCumulatingFlowDifferenceByUserAndStack);
router.get('/:userName/last-days', getDifferenceDataLastNDays);
router.get('/first-flow/:userName/:month', getFirstCumulativeFlowOfMonth);
router.get(
  '/last-flow/:userName/:month',
  getLastCumulativeFlowsForUserMonth
);

router.get('/report', getDifferenceReport);
// Fetch all daily-difference records for a given user/month/year
/* router.get(
  '/difference/month/:userName/:month/:year',
  getDifferenceDataByMonth
);
 */

module.exports = router;
