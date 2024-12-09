const mongoose = require('mongoose');

const liveStationSchema = new mongoose.Schema({
  userName: {
    type: String,
    required: true,
  },
  liveStationImage: {
    type: String, // Path of the uploaded image
  },
  nodes: {
    type: Array, // Store nodes configuration
    required: true,
  },
  edges: {
    type: Array, // Store edges configuration
    required: true,
  },
});

module.exports = mongoose.model('LiveStation', liveStationSchema);
