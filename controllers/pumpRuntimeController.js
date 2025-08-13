
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

const getRuntimeHistory = async (req, res) => {
  try {
    const { product_id, userName, from, to, pumpId } = req.query;

    if (!product_id || !userName || !from || !to) {
      return res.status(400).json({ message: "product_id, userName, from, to are required" });
    }

    // dates are stored as 'YYYY-MM-DD' strings, simple lexicographic range works
    const q = {
      product_id,
      userName,
      date: { $gte: from, $lte: to },
    };
    if (pumpId) q.pumpId = pumpId;

    const logs = await PumpRuntimeDaily.find(q).sort({ date: 1, pumpName: 1 }).lean();

    const formatHMS = (ms) => {
      const total = Math.floor(ms / 1000);
      const h = String(Math.floor(total / 3600)).padStart(2, '0');
      const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
      const s = String(total % 60).padStart(2, '0');
      return `${h}:${m}:${s}`;
    };

    const data = logs.map(l => ({
      date: l.date,
      pumpId: l.pumpId,
      pumpName: l.pumpName,
      totalRuntimeMs: l.totalRuntimeMs,
      runtime: formatHMS(l.totalRuntimeMs),
    }));

    res.status(200).json({ data });
  } catch (err) {
    console.error('Error in getRuntimeHistory:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};

const getRuntimePumps = async (req, res) => {
  try {
    const { product_id, userName } = req.params;
    if (!product_id || !userName) {
      return res.status(400).json({ message: "product_id and userName are required" });
    }

    const pumps = await PumpRuntimeDaily.aggregate([
      { $match: { product_id, userName } },
      { $group: { _id: { pumpId: "$pumpId", pumpName: "$pumpName" } } },
      { $project: { _id: 0, pumpId: "$_id.pumpId", pumpName: "$_id.pumpName" } },
      { $sort: { pumpName: 1 } }
    ]);

    res.status(200).json({ data: pumps });
  } catch (err) {
    console.error('Error in getRuntimePumps:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};


module.exports = {
  updateRuntimeFromRealtime,
  getDailyPumpRuntime,
  getRuntimeHistory,
  getRuntimePumps,
};