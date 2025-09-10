const PumpData = require('../models/PumpData'); // Adjust path if necessary
const moment = require('moment-timezone');

/**
 * Saves detailed pump metrics from an MQTT message.
 * @param {object} data - The parsed MQTT message payload.
 */
const savePumpMetrics = async (data) => {
    // Basic validation
    if (!data || !data.product_id || !Array.isArray(data.pumps) || data.pumps.length === 0) {
        console.error("Invalid or empty pump data received for saving metrics.");
        return;
    }

    // Use the device's NTP time if available, otherwise use the current server time
    const timestamp = data.ntpTime 
        ? moment.tz(data.ntpTime, "YYYY-MM-DD HH:mm:ss", "Asia/Kolkata").toDate() 
        : new Date();

    // Prepare an array of documents to be saved
    const recordsToSave = data.pumps.map(pump => ({
        product_id: data.product_id,
        userName: data.userName,
        pumpId: pump.pumpId,
        pumpName: pump.pumpName,
        timestamp: timestamp,
        vrn: pump.vrn,
        vyn: pump.vyn,
        vbn: pump.vbn,
        vry: pump.vry,
        vyb: pump.vyb,
        vbr: pump.vbr,
        red_phase_current: pump.red_phase_current,
        yellow_phase_current: pump.yellow_phase_current,
        blue_phase_current: pump.blue_phase_current,
        temperature: pump.temperature,
        vibration: pump.vibration,
        rpm: pump.rpm,
        status: (pump.status === 1 || pump.status === 'ON') ? 'ON' : 'OFF',
        fault: pump.fault
    }));

    try {
        // Use insertMany for efficient bulk insertion
        await PumpData.insertMany(recordsToSave);
        console.log(`✅ Successfully saved ${recordsToSave.length} pump metric records for product_id: ${data.product_id}`);
    } catch (error) {
        console.error("❌ Error saving pump metrics to database:", error);
    }
};

module.exports = { savePumpMetrics };