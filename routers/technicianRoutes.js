const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/technicianController');

// GET   /api/technician       -> fetch current tech
// POST  /api/technician       -> create or update tech
router.get('/technician',    ctrl.getTechnician);
router.post('/technician',   ctrl.upsertTechnician);

module.exports = router;
