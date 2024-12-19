const mongoose = require('mongoose');

const AvoidUserSchema = new mongoose.Schema({
  userName: { type: String, required: true },
  reason: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now }
});

const AvoidUser = mongoose.model('AvoidUser', AvoidUserSchema);

module.exports = AvoidUser;
