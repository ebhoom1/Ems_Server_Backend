// routes/billRoutes.js

const express = require('express');
const router = express.Router();
const { calculateElectricityBill } = require('../controllers/BillController');

router.post('/calculate-bill', calculateElectricityBill);

module.exports = router;
