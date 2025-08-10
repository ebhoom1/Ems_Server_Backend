// controllers/pumpStateController.js
const PumpState = require('../models/PumpState');

exports.updatePumpState = async (productId, pumpId, status) => {
  try {
    const updatedState = await PumpState.findOneAndUpdate(
      { productId, pumpId },
      { status, lastUpdated: new Date() },
      { upsert: true, new: true }
    );
    return updatedState;
  } catch (error) {
    console.error('Error updating pump state:', error);
    throw error;
  }
};

exports.getPumpState = async (productId, pumpId) => {
  try {
    const state = await PumpState.findOne({ productId, pumpId });
    return state || { status: false };
  } catch (error) {
    console.error('Error getting pump state:', error);
    throw error;
  }
};

exports.getPumpStatesByProduct = async (productId) => {
  try {
    return await PumpState.find({ productId });
  } catch (error) {
    console.error('Error getting pump states:', error);
    throw error;
  }
};
// This function updates the status and clears the pending flag on acknowledgment
exports.updatePumpState = async (productId, pumpId, status) => {
    return PumpState.findOneAndUpdate(
      { productId, pumpId },
      { status, pending: false, lastUpdated: new Date() },  // ← clear pending
      { upsert: true, new: true }
    );
  };
  
  // This new function sets the pending flag when a command is sent
  exports.setPumpPending = async (productId, pumpId, isPending) => {
    try {
        await PumpState.findOneAndUpdate(
            { productId: Number(productId), pumpId },
            { pending: isPending, lastUpdated: new Date() },
            { upsert: true, new: true }
        );
    } catch (error) {
        console.error('Error setting pump pending status:', error);
        throw error;
    }
};