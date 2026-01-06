const ValveState = require("../models/ValveState");

exports.updateValveState = async (productId, valveId, status) => {
  await ValveState.updateOne(
    { productId, valveId },
    { $set: { status } },
    { upsert: true }
  );
};

exports.setValvePending = async (productId, valveId, pending) => {
  await ValveState.updateOne(
    { productId, valveId },
    { $set: { pending } },
    { upsert: true }
  );
};

exports.getValveStates = async (req, res) => {
  try {
    const { productId } = req.params;
    const states = await ValveState.find({ productId });

    res.json(states);
  } catch (error) {
    console.error("Failed to load valve states:", error);
    res.status(500).json({ message: "Failed to load valve states" });
  }
};