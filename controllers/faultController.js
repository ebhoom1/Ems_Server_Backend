const Fault = require('../models/Fault');
const User = require('../models/user'); // Import at top level
const mongoose = require('mongoose');     
// Helper function for error responses
const handleError = (res, error, message = 'Server error') => {
  console.error(message, error);
  return res.status(500).json({ 
    success: false,
    message,
    error: error.message 
  });
};

exports.addFault = async (req, res) => {
  try {
    const newFault = new Fault(req.body);
    await newFault.save();
    res.status(201).json({ 
      success: true,
      message: 'Fault reported successfully', 
      fault: newFault 
    });
  } catch (error) {
    handleError(res, error, 'Failed to report fault');
  }
};

exports.getAllFaults = async (req, res) => {
  try {
    // fetch as plain objects, sorted by newest first
    const faults = await Fault.find()
      .sort({ createdAt: -1 })
      .lean();

    // if no documents, return early
    if (faults.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No faults found',
        count: 0,
        faults: []
      });
    }

    // transform each doc: _id → id, drop __v
    const transformed = faults.map(({ _id, __v, ...rest }) => ({
      id: _id,
      ...rest
    }));

    return res.status(200).json({
      success: true,
      message: 'Faults retrieved successfully',
      count: transformed.length,
      faults: transformed
    });

  } catch (error) {
    console.error('Failed to fetch faults:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch faults',
      error: error.message
    });
  }
};


exports.updateFaultStatus = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res
      .status(400)
      .json({ success: false, message: 'Invalid fault ID' });
  }

  try {
    const fault = await Fault.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!fault) {
      return res.status(404).json({ success: false, message: 'Fault not found' });
    }
    res.json({ success: true, message: 'Fault updated', fault });
  } catch (err) {
    handleError(res, err, 'Failed to update fault status');
  }
};

exports.getFaultsByUsername = async (req, res) => {
  try {
    const { username } = req.params;
    const faults = await Fault.find({ userName: username })
      .sort({ reportedDate: -1 });
    
    res.status(200).json({ 
      success: true,
      message: faults.length > 0 
        ? 'Faults retrieved successfully' 
        : 'No faults found for this user',
      count: faults.length,
      faults 
    });
  } catch (error) {
    handleError(res, error, 'Failed to fetch faults by username');
  }
};

exports.getFaultsByAdminType = async (req, res) => {
  try {
    const { adminType } = req.params;

    if (!adminType) {
      return res.status(400).json({
        success: false,
        message: "Please provide an adminType"
      });
    }

    let query = {};

    if (adminType !== 'EBHOOM') {
      // Find all users AND operators belonging to this adminType
      const relevantUsers = await User.find(
        { adminType, userType: { $in: ['user', 'operator'] } }, // <-- MODIFIED THIS LINE
        { userName: 1, _id: 0 }
      ).lean();

      if (!relevantUsers || relevantUsers.length === 0) {
        return res.status(200).json({
          success: true,
          message: "No relevant users or operators found for this adminType",
          faults: []
        });
      }

      // Use the userNames of both users and operators to query for faults
      query.userName = { $in: relevantUsers.map(u => u.userName) };
    }

    const faults = await Fault.find(query)
      .sort({ reportedDate: -1 });

    res.status(200).json({
      success: true,
      message: `Faults fetched for adminType: ${adminType}`,
      count: faults.length,
      faults
    });
  } catch (error) {
    // Assuming you have a handleError function defined elsewhere
    handleError(res, error, 'Error fetching faults by adminType');
  }
};