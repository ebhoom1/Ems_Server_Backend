const Technician = require('../models/Technician');
const User = require('../models/user');
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

exports.getCompaniesByTechnician = async (req, res) => {
  try {
    const { technicianId } = req.params;
    // Find users (companies) where the technicians array contains the given technicianId
    const companies = await User.find({ technicians: technicianId, userType: "user" }).select('_id userName companyName');

    if (!companies) {
      return res.status(404).json({ success: false, message: 'No companies found for this technician.' });
    }
    res.status(200).json({ success: true, companies });
  } catch (error) {
    console.error("Error fetching companies by technician:", error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};