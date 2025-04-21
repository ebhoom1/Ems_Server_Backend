const mongoose = require('mongoose');
const { Schema } = mongoose;

const TechnicianSchema = new Schema({
  name:        { type: String, required: true },
  designation: { type: String, required: true },
  email:       { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Technician', TechnicianSchema);
