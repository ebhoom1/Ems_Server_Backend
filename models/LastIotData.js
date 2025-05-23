// models/LastIotData.js
const mongoose = require('mongoose');

const lastIotDataSchema = new mongoose.Schema({
  userName: {
    type: String,
    required: true,
  },
  stationType: { // This needs to be a top-level field that is explicitly set
    type: String,
    required: true,
  },
  product_id:       String,
  stackData:        [ mongoose.Schema.Types.Mixed ], // array of objects
  date:             String,
  time:             String, // Make sure this is also a top-level field
  companyName:      String,
  industryType:     String,
  mobileNumber:     String,
  email:            String,
  timestamp:        Date,
  validationMessage:String,
  validationStatus: String,
});

// ensure one “last‐value” doc per userName+stationType
lastIotDataSchema.index(
  { userName: 1, stationType: 1 },
  { unique: true } // This ensures MongoDB creates a new document or updates an existing one based on these two fields.
);

module.exports = mongoose.model('LastIotData', lastIotDataSchema);