// models/tankData.js

const mongoose = require("mongoose");

// This defines the structure for a single tank's data within the array
const tankSchema = new mongoose.Schema({
  stackName: {
    type: String,
    required: true,
  },
  tankName: {
    type: String,
    required: true,
  },
  level: {
    type: Number,
    required: true,
    default: 0,
  },
  percentage: {
    type: Number,
    required: true,
    default: 0,
  },
}, { _id: false }); // _id: false prevents MongoDB from creating an ID for each sub-document

// This is the main schema for the entire record
const tankDataSchema = new mongoose.Schema({
  product_id: {
    type: String,
    required: true,
    index: true, // Add an index for faster queries by product_id
  },
  userName: {
    type: String,
    required: true,
  },
  companyName: {
    type: String,
  },
  tankData: [tankSchema], // An array of tank data using the schema above
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
  },
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt fields
  collection: 'tank_data_records' // Explicitly name the collection
});

module.exports = mongoose.model("TankData", tankDataSchema);