const Technician = require('../models/Technician');

// Get the single technician (we’ll assume only one exists)
exports.getTechnician = async (req, res) => {
  try {
    const tech = await Technician.findOne();
    res.json({ success: true, technician: tech });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Create or update the technician (upsert)
exports.upsertTechnician = async (req, res) => {
  try {
    const { name, designation, email } = req.body;
    const tech = await Technician.findOneAndUpdate(
      {},
      { name, designation, email },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, technician: tech });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
