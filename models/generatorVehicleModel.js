const mongoose = require('mongoose');

const generatorVehicleSchema = new mongoose.Schema({
  userName: { type: String, required: true },
  entryType: { type: String, enum: ['Generator', 'Vehicle'], required: true },
  generatorName: { type: String, default: null }, // Only for Generators
  vehicleName: { type: String, default: null }, // Only for Vehicles
  vehicleNumber: { type: String, default: null }, // Only for Vehicles
  fuelType: { type: String, enum: ['Petrol', 'Diesel', 'Electric', 'CNG'], required: true },
  averageFuelEconomy: { type: Number, default: null }, // Only for Vehicles
  litresUsed: { type: Number, required: true },
  date: { type: Date, required: true }
}, { timestamps: true });

module.exports = mongoose.model('GeneratorVehicle', generatorVehicleSchema);
