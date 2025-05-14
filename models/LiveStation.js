const mongoose = require('mongoose');

const liveStationSchema = new mongoose.Schema({
  userName:       { type: String, required: true },
  stationName:    { type: String, required: true },
  liveStationImage: String,
  nodes:          { type: Array, required: true },
  edges:          { type: Array, required: true },
 viewport:       { 
   type: Object,
  default: { x: 0, y: 0, zoom: 1 }
 },
})
// Remove the unique index if you want to allow multiple stations per user
// Just keep the compound index for querying efficiency
liveStationSchema.index({ userName: 1, stationName: 1 });

module.exports = mongoose.model('LiveStation', liveStationSchema);