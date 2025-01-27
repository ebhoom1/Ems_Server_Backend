const mongoose = require('mongoose');

const WasteSchema = new mongoose.Schema({
  userName: {
    type: String,
    required: true,
  },
  stationName: {
    type: String,
    required: true,
  },
  stationType: {
    type: String,
    required: true,
  },
  weight: {
    type: String,
    required: true,
  },
  date: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model('Waste', WasteSchema);
