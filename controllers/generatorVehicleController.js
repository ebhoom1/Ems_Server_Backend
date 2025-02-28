const GeneratorVehicle = require('../models/generatorVehicleModel');

// Add a new generator or vehicle entry
exports.addGeneratorVehicle = async (req, res) => {
  try {
    const newEntry = new GeneratorVehicle(req.body);
    await newEntry.save();
    res.status(201).json({ success: true, message: 'Entry added successfully', data: newEntry });
  } catch (error) {
    console.error('Error adding entry:', error);
    res.status(500).json({ success: false, message: 'Error adding entry', error: error.message });
  }
};

// Get all generator/vehicle entries
// Get all generator/vehicle entries with sorting and filtering
exports.getAllEntries = async (req, res) => {
    try {
      const { entryType, userName, fuelType, startDate, endDate } = req.query;
      
      let filter = {};
      if (entryType) filter.entryType = entryType;
      if (userName) filter.userName = userName;
      if (fuelType) filter.fuelType = fuelType;
      if (startDate && endDate) {
        filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
      }
  
      const entries = await GeneratorVehicle.find(filter).sort({ date: -1 }); // Sorting by latest entry first
  
      if (!entries || entries.length === 0) {
        return res.status(404).json({ success: false, message: 'No entries found.' });
      }
  
      res.status(200).json({ success: true, data: entries });
    } catch (error) {
      console.error('Error fetching entries:', error);
      res.status(500).json({ success: false, message: 'Error fetching entries', error: error.message });
    }
  };
