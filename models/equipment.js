// models/equipment.js
const mongoose = require('mongoose');

const equipmentSchema = new mongoose.Schema({
  equipmentName: { type: String, required: true },
  modelSerial:    { type: String,  },
  capacity:       { type: String,  },  // ← new
  ratedLoad:      { type: String,  },  // ← new
  installationDate: { type: Date,  },

  notes:          { type: String },
  userName:       { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Equipment', equipmentSchema);
