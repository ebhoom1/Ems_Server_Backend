const mongoose = require('mongoose');

const logoSchema = new mongoose.Schema({
    userName: { type: String, required: true },
    adminType: { type: String, required: true },
    logoUrl: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Logo', logoSchema);
