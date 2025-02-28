const Fuel = require('../models/fuelModel');

exports.addFuelEntry = async (req, res) => {
    try {
      console.log('Received Fuel Entry:', req.body);
  
      const { userName, entryType, name, vehicleNumber, fuelType, litresUsed, averageFuelEconomy, date } = req.body;
  
      // Check if required fields are present
      if (!userName || !entryType || !name || !fuelType || !litresUsed || !date) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
  
      // Ensure vehicle-specific fields are correctly handled
      const fuelEntryData = {
        userName,
        entryType,
        name,
        vehicleNumber: entryType === 'Vehicle' ? vehicleNumber || '' : null,
        fuelType,
        litresUsed,
        averageFuelEconomy: entryType === 'Vehicle' ? averageFuelEconomy || 0 : null,
        date: new Date(date), // Ensure date format is correct
      };
  
      const newFuel = new Fuel(fuelEntryData);
      await newFuel.save();
  
      res.status(201).json({ message: 'Fuel entry added successfully', fuelEntry: newFuel });
    } catch (error) {
      console.error('Error adding fuel entry:', error);
      res.status(500).json({ message: 'Failed to add fuel entry', error: error.message });
    }
  };
  

// ✅ Get all fuel entries
exports.getAllFuelEntries = async (req, res) => {
  try {
    const fuelEntries = await Fuel.find();
    res.status(200).json({ success: true, fuelEntries });
  } catch (error) {
    console.error('Error fetching fuel entries:', error);
    res.status(500).json({ message: 'Failed to fetch fuel entries', error });
  }
};

// ✅ Get fuel entries by user
exports.getFuelEntriesByUser = async (req, res) => {
  try {
    const { userName } = req.params;
    const fuelEntries = await Fuel.find({ userName });

    if (!fuelEntries.length) {
      return res.status(404).json({ message: 'No fuel entries found for this user' });
    }

    res.status(200).json({ success: true, fuelEntries });
  } catch (error) {
    console.error('Error fetching fuel entries by user:', error);
    res.status(500).json({ message: 'Failed to fetch fuel entries', error });
  }
};

// ✅ Delete a fuel entry
exports.deleteFuelEntry = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid Fuel Entry ID' });
      }
      
      const deletedEntry = await Fuel.findByIdAndDelete(id);
      
    if (!deletedEntry) {
      return res.status(404).json({ message: 'Fuel entry not found' });
    }

    res.status(200).json({ message: 'Fuel entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting fuel entry:', error);
    res.status(500).json({ message: 'Failed to delete fuel entry', error });
  }
};
