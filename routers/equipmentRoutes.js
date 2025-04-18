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
router.get('/:id', equipmentController.getEquipmentById);
module.exports = router;
