const express = require('express');
const router = express.Router();
const equipmentController = require('../controllers/equipmentController');
const Equipment = require('../models/equipment');

// Add Equipment
router.post('/add-equipment', equipmentController.addEquipment);

// Get Equipment List
router.get('/all-equipment', equipmentController.getAllEquipment);

//get by userName
router.get('/user/:userName', equipmentController.getEquipmentByUserName);
router.get('/admin-type-equipment/:adminType', equipmentController.getEquipmentByAdminType);
router.get('/equiment/:id', equipmentController.getEquipmentById);
router.get('/equiment/:id/maintenance-status', equipmentController.getMaintenanceStatus);
router.put('/equipment/:id', equipmentController.updateEquipment);

// Delete equipment
router.delete('/equipment/:id', equipmentController.deleteEquipment);
router.get('/operator-equipment/:userName', async (req, res) => {
  try {
    // Access req.params.userName (singular)
    const userName = req.params.userName;

    // If you intend to always query for a single userName:
    const equipment = await Equipment.find({ userName: userName });

    // If for some reason you still want it in an array for $in (though not strictly necessary for a single value):
    // const userNamesArray = [userName];
    // const equipment = await Equipment.find({ userName: { $in: userNamesArray } });

    res.json({ equipment });
  } catch (err) {
    console.error("Error in /api/operator-equipment:", err); // Log the actual error
    res.status(500).json({ message: "Server error: " + err.message });
  }
});

module.exports = router;
