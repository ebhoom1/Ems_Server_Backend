// controllers/tankDataController.js

const TankData = require("../models/tankData");

/**
 * Saves a new tank data record to the database.
 * @param {object} payload - The tank data payload received from MQTT.
 */
const saveTankData = async (payload) => {
  try {
    // Create a new document instance from our model
    const newTankRecord = new TankData({
      product_id: payload.product_id,
      userName: payload.userName,
      companyName: payload.companyName,
      tankData: payload.tankData, // The array of tank readings
      timestamp: payload.timestamp, // The timestamp from the payload
    });

    // Save the document to the database
    await newTankRecord.save();
    console.log("✅ Successfully saved tank data for product:", payload.product_id);

  } catch (error) {
    console.error("❌ Error saving tank data to database:", error.message);
  }
};

module.exports = {
  saveTankData,
};