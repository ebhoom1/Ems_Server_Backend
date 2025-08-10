// controllers/realtimeController.js
const PumpState = require('../models/PumpState');

const getRealtimePumpStatus = async (req, res) => {
    try {
        const { productId } = req.params;
       
        const pumpStates = await PumpState.find({productId});
        res.status(200).json(pumpStates);
    } catch (error) {
        console.error("Error fetching real-time pump status:", error);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports = {
    getRealtimePumpStatus,
};