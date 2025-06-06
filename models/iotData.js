// models/IotData.js

const mongoose = require("mongoose");

// Stack Schema to store sensor data (plus tank fields)
const StackSchema = new mongoose.Schema({
  stackName: { type: String, required: true },     // mandatory
  stationType: { type: String },

  // Sensor fields (strings)
  ph: { type: String },
  TDS: { type: String },
  TURB: { type: String },
  TEMP: { type: String },
  Temp: { type: String },
  BOD: { type: String },
  TOC: { type: String },
  COD: { type: String },
  TSS: { type: String },
  ORP: { type: String },
  nitrate: { type: String },
  ammonicalNitrogen: { type: String },
  DO: { type: String },
  chloride: { type: String },
  Flow: { type: String },
  Totalizer_Flow: { type: String },
  CO: { type: String },
  NOX: { type: String },
  Pressure: { type: String },
  Fluoride: { type: String },
  PM: { type: String },
  SO2: { type: String },
  NO2: { type: String },
  Mercury: { type: String },
  PM10: { type: String },
  PM25: { type: String },
  NOH: { type: String },
  NH3: { type: String },
  HCl: { type: String },
  total_chlorine: { type: String },
  chlorine: { type: String },
  WindSpeed: { type: String },
  WindDir: { type: String },
  AirTemperature: { type: String },
  Humidity: { type: String },
  solarRadiation: { type: String },
  DB: { type: String },

  // Numeric fields
  cumulatingFlow: { type: Number, default: 0 },
  flowRate: { type: Number, default: 0 },
  energy: { type: Number, default: 0 },
  voltage: { type: Number, default: 0 },
  current: { type: Number, default: 0 },
  power: { type: Number, default: 0 },
  weight: { type: Number, default: 0 },

  // New tank-specific fields:
  usdsid: { type: String },       // e.g. "USDS01"
  TankName: { type: String },     // e.g. "Tank1"
  level: { type: String },        // e.g. "0.000"
  percentage: { type: String },   // e.g. "0.000"

  maxValues: {
    type: Object,
    default: {},
  },
  minValues: {
    type: Object,
    default: {},
  },
});

// Pump Schema to store pump information
const PumpSchema = new mongoose.Schema({
  pumpId: { type: String, required: true },
  pumpName: { type: String, required: true },
  status: { type: String, enum: ["ON", "OFF"], required: true },
  timestamp: { type: Date, default: Date.now },
});

// IoT Data Schema to store all incoming data
const IotDataSchema = new mongoose.Schema({
  product_id: { type: String, required: true },
  stackData: {
    type: [StackSchema], // Array of StackSchema objects
    validate: {
      validator: (v) => Array.isArray(v) && v.length > 0,
      message: "stackData must contain at least one stack.",
    },
  },
  pumps: {
    type: [PumpSchema],
    default: [],
  },
  date: { type: String, required: true },
  time: { type: String, required: true },
  topic: { type: String, default: "N/A" },
  companyName: { type: String, required: true },
  industryType: { type: String, required: true },
  userName: { type: String, required: true },
  mobileNumber: { type: String, required: true },
  email: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  validationMessage: { type: String, default: "Validated" },
  validationStatus: { type: String, default: "Valid" },
  ExceedanceColor: { type: String },
  timeIntervalColor: { type: String },
  exceedanceComment: { type: String },
  timeIntervalComment: { type: String },
});

const IotData = mongoose.model("IotData", IotDataSchema);
module.exports = IotData;
