const DailyLog = require('../models/DailyLog');

// Create a new daily log
exports.createDailyLog = async (req, res) => {
  try {
    const {
      date,
      username,
      companyName,
      timeEntries,
      treatedWater,
      remarks,
      chemicalConsumption,
      backwashTimings,
      runningHoursReading,
      signOff,
      capacity
    } = req.body;

    // ensure only one per day/per user
    const exists = await DailyLog.findOne({ date, username });
    if (exists) {
      return res.status(400).json({ message: 'Log for this date/user already exists.' });
    }

    const log = new DailyLog({
      date,
      username,
      companyName,
      timeEntries,
      treatedWater,
      remarks,
      chemicalConsumption,
      backwashTimings,
      runningHoursReading,
      signOff,
      capacity
    });

    await log.save();
    res.status(201).json(log);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all logs (most recent first)
exports.getDailyLogs = async (req, res) => {
  try {
    const logs = await DailyLog.find().sort({ date: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get a single log by ID
exports.getDailyLogById = async (req, res) => {
  try {
    const log = await DailyLog.findById(req.params.id);
    if (!log) return res.status(404).json({ message: 'Log not found.' });
    res.json(log);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update an existing log
exports.updateDailyLog = async (req, res) => {
  try {
    const updated = await DailyLog.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Log not found.' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete a log
exports.deleteDailyLog = async (req, res) => {
  try {
    const deleted = await DailyLog.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Log not found.' });
    res.json({ message: 'Log deleted.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.getDailyLogsByUsername = async (req, res) => {
    try {
      const { username } = req.params;
      const logs = await DailyLog
        .find({ username })
        .sort({ date: -1 }); // newest first
      if (!logs.length) {
        return res.status(404).json({ message: `No logs found for user ${username}` });
      }
      res.json(logs);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  };