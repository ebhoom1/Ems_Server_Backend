const mongoose = require('mongoose');

const pumpDataSchema = new mongoose.Schema({
    // Identifying Information
    product_id: { type: String, required: true, index: true },
    userName: { type: String, required: true },
    pumpId: { type: String, required: true, index: true },
    pumpName: { type: String },
    
    // Timestamp from device
    timestamp: { type: Date, required: true, index: true },

    // Electrical Data (Voltage)
    vrn: { type: Number, default: 0 },
    vyn: { type: Number, default: 0 },
    vbn: { type: Number, default: 0 },
    vry: { type: Number, default: 0 },
    vyb: { type: Number, default: 0 },
    vbr: { type: Number, default: 0 },

    // Electrical Data (Current)
    red_phase_current: { type: Number, default: 0 },
    yellow_phase_current: { type: Number, default: 0 },
    blue_phase_current: { type: Number, default: 0 },

    // Sensor Data
    temperature: { type: Number, default: 0 },
    vibration: { type: Number, default: 0 },
    rpm: { type: Number, default: 0 },
    
    // Status Information
    status: { type: String, enum: ['ON', 'OFF'], required: true },
    fault: { type: String, default: 'NO' }
}, {
    // Adds createdAt and updatedAt timestamps automatically
    timestamps: true 
});

const PumpData = mongoose.model('PumpData', pumpDataSchema);

module.exports = PumpData;