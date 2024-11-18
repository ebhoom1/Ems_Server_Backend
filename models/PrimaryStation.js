const mongoose = require('mongoose');

const primaryStationSchema = new mongoose.Schema({
  userName: { type: String, required: true },
  stationType: { type: String, required: true },
  stackName: { type: String, required: true }
});

const PrimaryStation = mongoose.model('PrimaryStation', primaryStationSchema);

module.exports = PrimaryStation;
