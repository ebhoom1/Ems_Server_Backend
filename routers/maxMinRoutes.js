const express = require('express');
const router = express.Router();
const { getMaxMinDataByUserAndStack, getMaxMinDataByUser,
    getMaxMinDataByDateRange , 
    getYesterdayMinMaxData
 } = require('../controllers/maxMinController');
// Route to get data by userName and stackName
router.get('/minMax/:userName/stack/:stackName', async (req, res) => {
    const { userName, stackName } = req.params;

    try {
        const result = await getMaxMinDataByUserAndStack(userName, stackName);
        if (!result.success) {
            return res.status(404).json({ success: false, message: result.message });
        }
        res.status(200).json({ success: true, data: result.data });
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ success: false, message: 'Error fetching data', error: error.message });
    }
});

// Route to get data by userName only
router.get('/minMax/:userName', async (req, res) => {
    const { userName } = req.params;

    try {
        const result = await getMaxMinDataByUser(userName);
        if (!result.success) {
            return res.status(404).json({ success: false, message: result.message });
        }
        res.status(200).json({ success: true, data: result.data });
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ success: false, message: 'Error fetching data', error: error.message });
    }
});

router.get('/maxmin/:userName/:stackName', (req, res) => {
    console.log("Route Params:", req.params);
    console.log("Query Params:", req.query);
    getMaxMinDataByDateRange(req, res);
});
// ✅ **New Route: Get Yesterday's Min/Max Data**
router.get('/minMax/yesterday/:userName', getYesterdayMinMaxData);
module.exports = router;