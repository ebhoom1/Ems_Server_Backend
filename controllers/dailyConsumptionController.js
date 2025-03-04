// controllers/dailyConsumptionController.js
const DailyConsumption = require('../models/dailyConsumptionModel');

// Save or update a daily consumption record
exports.saveDailyConsumption = async (req, res) => {
  try {
    const { userName, stackName, date, consumption } = req.body;

    if (!userName || !stackName || !date || consumption === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userName, stackName, date, or consumption',
      });
    }

    // Check if a record already exists for the given userName, stackName, and date
    let record = await DailyConsumption.findOne({ userName, stackName, date });
    if (record) {
      // Update the consumption value if record exists
      record.consumption = consumption;
      await record.save();
      return res.status(200).json({
        success: true,
        message: 'Daily consumption updated',
        data: record,
      });
    } else {
      // Create a new record
      record = new DailyConsumption({ userName, stackName, date, consumption });
      await record.save();
      return res.status(201).json({
        success: true,
        message: 'Daily consumption saved',
        data: record,
      });
    }
  } catch (error) {
    console.error('Error saving daily consumption:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// Get daily consumption records (optionally filter by userName)
exports.getDailyConsumptions = async (req, res) => {
  try {
    const { userName } = req.query;
    let query = {};
    if (userName) query.userName = userName;

    const records = await DailyConsumption.find(query).sort({ date: -1 });
    return res.status(200).json({ success: true, data: records });
  } catch (error) {
    console.error('Error fetching daily consumption:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
