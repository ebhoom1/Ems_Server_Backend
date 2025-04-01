const Fault = require('../models/Fault');

exports.addFault = async (req, res) => {
  try {
    const newFault = new Fault(req.body);
    await newFault.save();
    res.status(201).json({ message: 'Fault reported successfully', fault: newFault });
  } catch (error) {
    res.status(500).json({ message: 'Failed to report fault', error });
  }
};

exports.getAllFaults = async (req, res) => {
  try {
    const faults = await Fault.find();
    res.status(200).json({ faults });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch faults', error });
  }
};

exports.updateFaultStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const update = req.body;
    const fault = await Fault.findByIdAndUpdate(id, update, { new: true });
    res.status(200).json({ message: 'Fault status updated', fault });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update fault status', error });
  }
};

// Existing controller functions...

exports.getFaultsByUsername = async (req, res) => {
  try {
    const { username } = req.params;
    const faults = await Fault.find({ userName: username });
    
    if (faults.length === 0) {
      return res.status(404).json({ 
        message: 'No faults found for this user',
        username
      });
    }
    
    res.status(200).json({ 
      message: 'Faults retrieved successfully',
      count: faults.length,
      faults 
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Failed to fetch faults by username',
      error: error.message 
    });
  }
};

// Get faults by adminType
exports.getFaultsByAdminType = async (req, res) => {
    const { adminType } = req.params;
  
    if (!adminType) {
      return res.status(400).json({ error: "Please provide an adminType" });
    }
  
    try {
      const User = require('../models/user'); // Import User model
      
      let query = {};
      
      if (adminType === 'EBHOOM') {
        // For EBHOOM, get all faults
        query = {};
      } else {
        // For other adminTypes, first get users with that adminType
        const users = await User.find(
          { adminType, userType: 'user' },
          { userName: 1, _id: 0 }
        ).lean();
  
        if (!users || users.length === 0) {
          return res.status(200).json({
            message: "No faults found - no users for this adminType",
            faults: []
          });
        }
  
        const userNames = users.map(user => user.userName);
        query = { userName: { $in: userNames } };
      }
      
      // Get faults based on the query
      const faults = await Fault.find(query).sort({ reportedDate: -1 });
  
      res.status(200).json({
        message: `Faults fetched for adminType: ${adminType}`,
        count: faults.length,
        faults
      });
    } catch (error) {
      console.error(`Error fetching faults by adminType: ${error.message}`);
      res.status(500).json({ 
        message: "Error fetching faults by adminType",
        error: error.message 
      });
    }
  };