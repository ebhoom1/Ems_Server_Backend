
const Equipment = require('../models/equipment');
const User = require('../models/user')
const MechanicalReport = require('../models/MechanicalReport');
const ElectricalReport = require('../models/ElectricalReport');
const ServiceReport = require("../models/ServiceReport");
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


// Get all equipment -old
/* exports.getAllEquipment = async (req, res) => {
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
 */
//new 

exports.getAllEquipment = async (req, res) => {
  try {
    // Step 1: Fetch all equipment. Use .lean() for better performance and plain JS objects.
    const equipmentList = await Equipment.find().sort({ createdAt: -1 }).lean();

    // Step 2: Asynchronously process each item in the list to add its maintenance status.
    // Promise.all runs these checks in parallel for maximum efficiency.
    const equipmentWithStatus = await Promise.all(
      equipmentList.map(async (equipment) => {
        // const now = new Date();
        // const thisMonth = now.getMonth(); // 0-11
        // const thisYear = now.getFullYear();

        // // Check for the most recent Mechanical report for this equipment
        // const lastMech = await MechanicalReport.findOne({ equipmentId: equipment._id }).sort({ timestamp: -1 });

        // // Check for the most recent Electrical report for this equipment
        // const lastElec = await ElectricalReport.findOne({ equipmentId: equipment._id }).sort({ timestamp: -1 });

        // // Determine if a new report can be created this month
        // const canMechanical = !lastMech || 
        //   !(new Date(lastMech.timestamp).getMonth() === thisMonth && new Date(lastMech.timestamp).getFullYear() === thisYear);

        // const canElectrical = !lastElec || 
        //   !(new Date(lastElec.timestamp).getMonth() === thisMonth && new Date(lastElec.timestamp).getFullYear() === thisYear);

        // // Step 3: Return a new object combining the original equipment data with its new status
        // return {
        //   ...equipment,
        //   canMechanical,
        //   canElectrical,
        // };
        const now = new Date();
        const thisYear = now.getFullYear();

        const lastMech = await MechanicalReport.findOne({ equipmentId: equipment._id })
          .sort({ createdAt: -1 });

        const lastElec = await ElectricalReport.findOne({ equipmentId: equipment._id })
          .sort({ createdAt: -1 });

        const lastService = await ServiceReport.findOne({ equipmentId: equipment._id })
          .sort({ createdAt: -1 });

        const isThisYear = (date) =>
          date && new Date(date).getFullYear() === thisYear;

        const hasMechanical = lastMech && isThisYear(lastMech.timestamp);
        const hasElectrical = lastElec && isThisYear(lastElec.timestamp);
        const hasService = lastService && isThisYear(lastService.createdAt);

        return {
          ...equipment,
          hasMechanical,
          hasElectrical,
          hasService,
        };
      })
    );

    // Step 4: Send the complete, enhanced list to the client
    res.status(200).json({
      message: "Equipment list fetched successfully",
      equipment: equipmentWithStatus, // Send the new list with statuses
    });

  } catch (error) {
    res.status(500).json({ message: "Error fetching equipment list", error: error.message });
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

exports.getEquipmentById = async (req, res) => {
  try {
    const equip = await Equipment.findById(req.params.id);
    if (!equip) {
      return res.status(404).json({ message: 'Equipment not found' });
    }
    res.json({ equipment: equip }); // ✅ Must return `equipment: ...`
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};


// controllers/equipmentController.js
exports.getMaintenanceStatus = async (req, res) => {
  const equipmentId = req.params.id;

  try {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    // Fetch last reports
    const [lastMech] = await MechanicalReport.find({ equipmentId })
      .sort({ timestamp: -1 })
      .limit(1);

    const [lastElec] = await ElectricalReport.find({ equipmentId })
      .sort({ timestamp: -1 })
      .limit(1);

    const [lastService] = await ServiceReport.find({ equipmentId })
      .sort({ createdAt: -1 })
      .limit(1);

    // Helper: check if given date is in this month/year
    const isThisMonth = (date) =>
      date &&
      new Date(date).getMonth() === thisMonth &&
      new Date(date).getFullYear() === thisYear;

    // ✅ Use correct fields per report type
    const hasMechanical = lastMech && isThisMonth(lastMech.timestamp);
    const hasElectrical = lastElec && isThisMonth(lastElec.timestamp);
    const hasService = lastService && isThisMonth(lastService.createdAt);

    return res.status(200).json({
      hasMechanical,
      hasElectrical,
      hasService,
    });
  } catch (error) {
    console.error("Error in getMaintenanceStatus:", error);
    return res.status(500).json({
      message: "Error checking maintenance status",
      error: error.message,
    });
  }
};


// Update equipment by ID
exports.updateEquipment = async (req, res) => {
  try {
    const equipmentId = req.params.id;
    const updatedEquipment = await Equipment.findByIdAndUpdate(
      equipmentId,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedEquipment) {
      return res.status(404).json({ message: "Equipment not found" });
    }

    res.status(200).json({
      message: "Equipment updated successfully",
      equipment: updatedEquipment,
    });
  } catch (error) {
    console.error("Error updating equipment:", error);
    res.status(500).json({ message: "Error updating equipment", error });
  }
};

// Delete equipment by ID
exports.deleteEquipment = async (req, res) => {
  try {
    const equipmentId = req.params.id;
    const deletedEquipment = await Equipment.findByIdAndDelete(equipmentId);

    if (!deletedEquipment) {
      return res.status(404).json({ message: "Equipment not found" });
    }

    res.status(200).json({ message: "Equipment deleted successfully" });
  } catch (error) {
    console.error("Error deleting equipment:", error);
    res.status(500).json({ message: "Error deleting equipment", error });
  }
};