// controllers/requestInventoryController.js
const RequestInventory = require("../models/RequestInventory");

exports.addRequestInventory = async (req, res) => {
  try {
    const { userName, skuName, quantityRequested, reason } = req.body;
    if (!userName || !skuName || quantityRequested == null) {
      return res.status(400).json({ error: "userName, skuName and quantityRequested are required." });
    }
    const newRequest = new RequestInventory({
      userName,
      skuName,
      quantityRequested,
      reason,
      requestDate: new Date(),
      status: "Pending",
    });
    const savedRequest = await newRequest.save();
    res.status(201).json({ message: "Request inventory added successfully", request: savedRequest });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getRequestInventory = async (req, res) => {
  try {
    const requests = await RequestInventory.find();
    res.status(200).json({ requestLogs: requests });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // Expected to be either "Approved" or "Denied"
    if (!["Approved", "Denied"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const updatedRequest = await RequestInventory.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
    if (!updatedRequest) {
      return res.status(404).json({ error: "Request not found" });
    }
    res.status(200).json({ message: "Request status updated successfully", request: updatedRequest });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// Get inventory requests by adminType
exports.getRequestByAdminType = async (req, res) => {
  const { adminType } = req.params;

  if (!adminType) {
    return res.status(400).json({ error: "Please provide an adminType" });
  }

  try {
    const User = require('../models/user'); // Import User model
    
    let query = {};
    
    if (adminType === 'EBHOOM') {
      // For EBHOOM, get all requests
      query = {};
    } else {
      // For other adminTypes, first get users with that adminType
      const users = await User.find(
        { adminType, userType: 'user' },
        { userName: 1, _id: 0 }
      ).lean();

      if (!users || users.length === 0) {
        return res.status(200).json({
          message: "No requests found - no users for this adminType",
          requests: []
        });
      }

      const userNames = users.map(user => user.userName);
      query = { userName: { $in: userNames } };
    }
    
    // Get requests based on the query
    const requests = await RequestInventory.find(query)
      .sort({ requestDate: -1 }); // Newest first

    res.status(200).json({
      message: `Requests fetched for adminType: ${adminType}`,
      count: requests.length,
      requests
    });
  } catch (error) {
    console.error(`Error fetching requests by adminType: ${error.message}`);
    res.status(500).json({ 
      message: "Error fetching requests by adminType",
      error: error.message 
    });
  }
};

// Get inventory requests by username
exports.getRequestByUsername = async (req, res) => {
  const { username } = req.params;

  if (!username) {
    return res.status(400).json({ error: "Please provide a username" });
  }

  try {
    // First verify the user exists
    const User = require('../models/user');
    const user = await User.findOne({ userName: username });
    
    if (!user) {
      return res.status(404).json({ 
        message: "User not found",
        username 
      });
    }

    // Get requests for this user
    const requests = await RequestInventory.find({ userName: username })
      .sort({ requestDate: -1 }); // Newest first

    res.status(200).json({
      message: `Requests fetched for user: ${username}`,
      count: requests.length,
      requests
    });
  } catch (error) {
    console.error(`Error fetching requests by username: ${error.message}`);
    res.status(500).json({ 
      message: "Error fetching requests by username",
      error: error.message 
    });
  }
};