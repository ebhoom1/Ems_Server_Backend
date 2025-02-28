const mongoose = require('mongoose');

const FuelSchema = new mongoose.Schema({
  userName: { type: String, required: true },
  entryType: { type: String, enum: ['Generator', 'Vehicle'], required: true },
  name: { type: String, required: true }, // Generator or Vehicle Name
  vehicleNumber: { type: String }, // Only for vehicles
  fuelType: { type: String, enum: ['Petrol', 'Diesel', 'Electric', 'CNG'], required: true },
  litresUsed: { type: Number, required: true },
  averageFuelEconomy: { type: Number }, // Only for vehicles
  date: { type: Date, required: true, default: Date.now },
}, { timestamps: true });

const Fuel = mongoose.model('Fuel', FuelSchema);
module.exports = Fuel;
