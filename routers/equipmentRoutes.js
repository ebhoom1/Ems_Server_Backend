const express = require('express');
const router = express.Router();
const equipmentController = require('../controllers/equipmentController');

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
module.exports = router;
