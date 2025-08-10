const express = require('express');
const router = express.Router();

// ← Add this import
const PumpState = require('../models/PumpState');
const pumpStateController = require('../controllers/pumpStateController');

// Get state for a specific pump
router.get('/pump-states/:productId/:pumpId', async (req, res) => {
  try {
    const state = await pumpStateController.getPumpState(
      req.params.productId,
      req.params.pumpId
    );
    res.json(state);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all pump states for a product
router.get('/pump-states/:productId', async (req, res) => {
  try {
    const states = await pumpStateController.getPumpStatesByProduct(
      req.params.productId
    );
    res.json(states);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ← Your new PATCH endpoint
router.patch('/pump-states/:productId/:pumpId', async (req, res) => {
  try {
    const { status, pending } = req.body;
    const updated = await PumpState.findOneAndUpdate(
      { productId: req.params.productId, pumpId: req.params.pumpId },
      { status, pending, lastUpdated: new Date() },
      { upsert: true, new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;