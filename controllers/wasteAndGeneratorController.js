const Waste = require('../models/wasteAndGeneratorModel');

// Get all waste records
exports.getAllWaste = async (req, res) => {
  try {
    const wasteData = await Waste.find();
    res.status(200).json({ success: true, wasteData });
  } catch (error) {
    console.error('Error fetching waste data:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch waste data.' });
  }
};

// Add a new waste record
exports.addWaste = async (req, res) => {
  const { userName, stationName, stationType, weight, date } = req.body;

  if (!userName || !stationName || !stationType || !weight || !date) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  try {
    const newWaste = new Waste({ userName, stationName, stationType, weight, date });
    await newWaste.save();
    res.status(201).json({ success: true, message: 'Waste bin added successfully.' });
  } catch (error) {
    console.error('Error adding waste:', error);
    res.status(500).json({ success: false, message: 'Failed to add waste bin.' });
  }
};

// Edit an existing waste record
exports.editWaste = async (req, res) => {
  const { id } = req.params;
  const { userName, stationName, stationType, weight, date } = req.body;

  if (!userName || !stationName || !stationType || !weight || !date) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }

  try {
    const waste = await Waste.findById(id);
    if (!waste) {
      return res.status(404).json({ success: false, message: 'Waste record not found.' });
    }

    // Update the waste record
    waste.userName = userName;
    waste.stationName = stationName;
    waste.stationType = stationType;
    waste.weight = weight;
    waste.date = date;

    await waste.save();
    res.status(200).json({ success: true, message: 'Waste record updated successfully.', waste });
  } catch (error) {
    console.error('Error updating waste:', error);
    res.status(500).json({ success: false, message: 'Failed to update waste record.' });
  }
};

// Delete a waste record
exports.deleteWaste = async (req, res) => {
  const { id } = req.params;

  try {
    const waste = await Waste.findById(id);
    if (!waste) {
      return res.status(404).json({ success: false, message: 'Waste record not found.' });
    }

    await Waste.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'Waste record deleted successfully.' });
  } catch (error) {
    console.error('Error deleting waste:', error);
    res.status(500).json({ success: false, message: 'Failed to delete waste record.' });
  }
};
