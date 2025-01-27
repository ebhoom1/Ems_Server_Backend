const express = require('express');
const router = express.Router();
const wasteController = require('../controllers/wasteAndGeneratorController');

// Routes
router.get('/getallwaste', wasteController.getAllWaste); // Fetch all waste records
router.post('/addwaste', wasteController.addWaste); // Add a new waste record
router.put('/editwaste/:id', wasteController.editWaste); // Edit an existing waste record
router.delete('/waste/:id', wasteController.deleteWaste); // Delete a waste record

module.exports = router;
