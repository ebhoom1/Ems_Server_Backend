// // 📦 BACKEND: pumpRuntimeController.js
// // const PumpRuntimeLog = require('../models/PumpRuntimeLog');
// const PumpRuntimeDaily = require('../models/PumpRuntimeDaily');
// const moment = require('moment');

// const getPumpRuntimePerDay = async (req, res) => {
//   try {
//     const { userName, product_id } = req.params;
//     const records = await PumpRuntimeDaily.find({ userName, product_id });
//     res.status(200).json({ data: records });
//   } catch (err) {
//     console.error('Error in getPumpRuntimePerDay:', err);
//     res.status(500).json({ message: 'Server Error' });
//   }
// };

// // 🆕 Save or update runtime every ON/OFF event
// const updateRuntimeFromRealtime = async ({
//   product_id,
//   userName,
//   pumpId,
//   pumpName,
//   status,
//   timestamp
// }) => {
//   try {
//     const ts = moment(timestamp);
//     const dateStr = ts.format('YYYY-MM-DD');

//     // Find existing daily runtime record
//     let record = await PumpRuntimeDaily.findOne({ userName, product_id, pumpId, date: dateStr });
//     if (!record) {
//       record = new PumpRuntimeDaily({
//         userName,
//         product_id,
//         pumpId,
//         pumpName,
//         date: dateStr,
//         totalRuntimeMs: 0,
//         lastOnTime: null,
//       });
//     }
//     if (status === 'ON') {
//       record.lastOnTime = ts.toISOString();
//     } else if (status === 'OFF' && record.lastOnTime){
//       const onTime = moment(record.lastOnTime);
//       const durationMs = ts.diff(onTime);
//       record.totalRuntimeMs += durationMs;
//       record.lastOnTime = null;
//     }
//     await record.save();
//   } catch (err) {
//     console.error('Error updating runtime:', err);
//   }
// };

// module.exports = {
//   getPumpRuntimePerDay,
//   updateRuntimeFromRealtime,
// };



const moment = require('moment');
const PumpRuntimeDaily = require('../models/PumpRuntimeDailySchema');

// Save runtime every ON/OFF
const updateRuntimeFromRealtime = async ({ product_id, userName, pumpId, pumpName, status, timestamp }) => {
  try {
    const ts = moment(timestamp);
    const dateStr = ts.format('YYYY-MM-DD');

    let record = await PumpRuntimeDaily.findOne({ userName, product_id, pumpId, date: dateStr });

    if (!record) {
      record = new PumpRuntimeDaily({
        userName,
        product_id,
        pumpId,
        pumpName,
        date: dateStr,
        totalRuntimeMs: 0,
        lastOnTime: null
      });
    }

    if (status === 'ON') {
      if (!record.lastOnTime) {
        record.lastOnTime = ts.toISOString();
      }
    } else if (status === 'OFF' && record.lastOnTime) {
      const onTime = moment(record.lastOnTime);
      const durationMs = ts.diff(onTime);
      if (durationMs > 0) {
        record.totalRuntimeMs += durationMs;
      }
      record.lastOnTime = null;
    }

    await record.save();
    // Emit updated runtime to client via socket.io
if (global.io) {
  const runtimeSeconds = Math.floor(record.totalRuntimeMs / 1000);
  const hours = String(Math.floor(runtimeSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((runtimeSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(runtimeSeconds % 60).padStart(2, '0');

  global.io.to(`${product_id}`).emit("pumpRuntimeUpdate", {
    userName,
    product_id,
    pumpId,
    pumpName,
    date: dateStr,
    runtime: `${hours}:${minutes}:${seconds}`,
    lastOnTime: record.lastOnTime 
  });
}

  } catch (err) {
    console.error('Error updating runtime:', err);
  }
};

// Get runtime for all pumps on a given day
const getDailyPumpRuntime = async (req, res) => {
  try {
    const { product_id, userName, date } = req.params;
    const logs = await PumpRuntimeDaily.find({ product_id, userName, date });

    const result = logs.map(log => {
      const runtimeSeconds = Math.floor(log.totalRuntimeMs / 1000);
      const hours = String(Math.floor(runtimeSeconds / 3600)).padStart(2, '0');
      const minutes = String(Math.floor((runtimeSeconds % 3600) / 60)).padStart(2, '0');
      const seconds = String(runtimeSeconds % 60).padStart(2, '0');

      return {
        pumpId: log.pumpId,
        pumpName: log.pumpName,
        runtime: `${hours}:${minutes}:${seconds}`,
        date: log.date
      };
    });

    res.status(200).json({ data: result });
  } catch (err) {
    console.error('Error in getDailyPumpRuntime:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};

module.exports = {
  updateRuntimeFromRealtime,
  getDailyPumpRuntime
};