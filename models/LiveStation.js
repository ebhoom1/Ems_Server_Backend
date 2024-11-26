const mongoose = require('mongoose');

const liveStationSchema = new mongoose.Schema({
  userName: {
    type: String,
    required: true,
  },
  liveStationImage: {
    type: String, // This will store the path of the uploaded image
    required: true,
  },
});

module.exports = mongoose.model('LiveStation', liveStationSchema);
