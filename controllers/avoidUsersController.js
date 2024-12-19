const AvoidUser = require('../models/avoidUsers');

// Add a user to the avoid list
exports.addAvoidUser = async (req, res) => {
    try {
      const { userName, reason } = req.body;
  
      if (!userName) {
        return res.status(400).json({ message: 'UserName is required' });
      }
  
      const existingUser = await AvoidUser.findOne({ userName });
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists in avoid list' });
      }
  
      const newAvoidUser = new AvoidUser({ userName, reason });
      await newAvoidUser.save();
  
      res.status(201).json({ message: 'User added to avoid list successfully', data: newAvoidUser });
    } catch (error) {
      console.error('Error adding user to avoid list:', error.message);
      res.status(500).json({ message: 'Failed to add user to avoid list', error: error.message });
    }
  };
  

// Remove a user from the avoid list
exports.removeAvoidUser = async (req, res) => {
  try {
    const { userName } = req.params;

    const deletedUser = await AvoidUser.findOneAndDelete({ userName });
    if (!deletedUser) {
      return res.status(404).json({ message: 'User not found in avoid list' });
    }

    res.status(200).json({ message: 'User removed from avoid list successfully', data: deletedUser });
  } catch (error) {
    res.status(500).json({ message: 'Failed to remove user from avoid list', error: error.message });
  }
};

// Fetch all avoided users
exports.getAllAvoidUsers = async (req, res) => {
  try {
    const avoidUsers = await AvoidUser.find();
    res.status(200).json({ message: 'Avoid list fetched successfully', data: avoidUsers });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch avoid list', error: error.message });
  }
};
