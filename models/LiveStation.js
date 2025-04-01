const mongoose = require('mongoose');

const liveStationSchema = new mongoose.Schema({
  userName: {
    type: String,
    required: true,
    // REMOVE any unique: true here
  },
  stationName: {
    type: String,
    required: true,
  },
  liveStationImage: {
    type: String, // URL/path of the uploaded image
  },
  nodes: {
    type: Array, // Store nodes configuration
    required: true,
  },
  edges: {
    type: Array, // Store edges configuration
  },
});

// Remove the unique index if you want to allow multiple stations per user
// Just keep the compound index for querying efficiency
liveStationSchema.index({ userName: 1, stationName: 1 });

module.exports = mongoose.model('LiveStation', liveStationSchema);