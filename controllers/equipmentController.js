const Equipment = require('../models/equipment');
const User = require('../models/user')
// Add new equipment
exports.addEquipment = async (req, res) => {
    try {
      const newEquipment = new Equipment(req.body);
      const savedEquipment = await newEquipment.save();
      res.status(201).json({
        message: "Equipment added successfully",
        equipment: savedEquipment,
      });
    } catch (error) {
      res.status(500).json({ message: "Error adding equipment", error });
    }
  };
  

// Get all equipment
exports.getAllEquipment = async (req, res) => {
    try {
      const equipmentList = await Equipment.find().sort({ createdAt: -1 });
      res.status(200).json({
        message: "Equipment list fetched successfully",
        equipment: equipmentList,
      });
    } catch (error) {
      res.status(500).json({ message: "Error fetching equipment list", error });
    }
  };
  
 // Get equipment by userName
exports.getEquipmentByUserName = async (req, res) => {
    const { userName } = req.params;
  
    try {
      const equipmentList = await Equipment.find({ userName }).sort({ createdAt: -1 });
  
      if (equipmentList.length === 0) {
        return res.status(404).json({
          message: `No equipment found for user: ${userName}`,
          equipment: [],
        });
      }
  
      res.status(200).json({
        message: `Equipment list fetched for user: ${userName}`,
        equipment: equipmentList,
      });
    } catch (error) {
      res.status(500).json({ message: "Error fetching equipment", error });
    }
  };
   // Get equipment by adminType
// Get equipment by adminType
exports.getEquipmentByAdminType = async (req, res) => {
    const { adminType } = req.params;
  
    if (!adminType) {
      return res.status(400).json({ error: "Please provide an adminType" });
    }
  
    try {
      let query = {};
  
      if (adminType === 'EBHOOM') {
        // Show all equipment if adminType is EBHOOM
        query = {};
      } else {
        // For other adminTypes, only show equipment belonging to their users
        // First find all users with this adminType
        const users = await User.find(  // Changed from userdb to User
          { adminType, userType: 'user' },
          { userName: 1, _id: 0 } // Only get usernames, exclude _id
        ).lean();
  
        if (!users || users.length === 0) {
          return res.status(200).json({
            message: "No equipment found - no users for this adminType",
            equipment: []
          });
        }
  
        const userNames = users.map(user => user.userName);
        query = { userName: { $in: userNames } };
      }
  
      const equipmentList = await Equipment.find(query).sort({ createdAt: -1 });
  
      res.status(200).json({
        message: `Equipment list fetched for adminType: ${adminType}`,
        count: equipmentList.length,
        equipment: equipmentList
      });
  
    } catch (error) {
      console.error(`Error fetching equipment by adminType: ${error.message}`);
      res.status(500).json({ 
        message: "Error fetching equipment by adminType",
        error: error.message 
      });
    }
  };