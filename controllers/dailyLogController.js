const DailyLog = require("../models/DailyLog");

// Create a new daily log
exports.createDailyLog = async (req, res) => {
  try {
    const {
      date,
      username,
      companyName,
      timeEntries,
      treatedWater,
      remarks,
      chemicalConsumption,
      backwashTimings,
      runningHoursReading,
      signOff,
      capacity,
    } = req.body;

    const [Y, M, D] = date.split("-").map(Number);
    const utcMid = new Date(Date.UTC(Y, M - 1, D, 0, 0, 0));

    // ensure only one per day/per user

    const exists = await DailyLog.findOne({
      date: {
        $gte: utcMid,
        $lt: new Date(utcMid.getTime() + 24 * 60 * 60 * 1000),
      },
      username,
    });
    if (exists) {
      return res
        .status(400)
        .json({ message: "Log for this date/user already exists." });
    }

    const log = new DailyLog({
      date: utcMid,
      username,
      companyName,
      timeEntries,
      treatedWater,
      remarks,
      chemicalConsumption,
      backwashTimings,
      runningHoursReading,
      signOff,
      capacity,
    });

    await log.save();
    res.status(201).json(log);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all logs (most recent first)
exports.getDailyLogs = async (req, res) => {
  try {
    const logs = await DailyLog.find().sort({ date: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get a single log by ID
exports.getDailyLogById = async (req, res) => {
  try {
    const log = await DailyLog.findById(req.params.id);
    if (!log) return res.status(404).json({ message: "Log not found." });
    res.json(log);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update an existing log
exports.updateDailyLog = async (req, res) => {
  try {
    const updated = await DailyLog.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!updated) return res.status(404).json({ message: "Log not found." });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete a log
exports.deleteDailyLog = async (req, res) => {
  try {
    const deleted = await DailyLog.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Log not found." });
    res.json({ message: "Log deleted." });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
exports.getDailyLogsByUsername = async (req, res) => {
  try {
    const { username } = req.params;
    const logs = await DailyLog.find({ username }).sort({ date: -1 }); // newest first
    if (!logs.length) {
      return res
        .status(404)
        .json({ message: `No logs found for user ${username}` });
    }
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// exports.upsertDailyLog = async (req, res) => {
//   try {
//     const {
//       date,
//       username,
//       companyName,
//       timeEntries,
//       treatedWater,
//       remarks,
//       chemicalConsumption,
//       backwashTimings,
//       runningHoursReading,
//       signOff,
//       capacity,
//     } = req.body;

//     const log = await DailyLog.findOne({
//       companyName,
//       date: {
//         $gte: new Date(date),
//         $lt: new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000),
//       },
//     });

//     if (log) {
//       if (timeEntries?.length) log.timeEntries = timeEntries;
//       if (treatedWater?.length) log.treatedWater = treatedWater;
//       if (remarks) log.remarks = remarks;
//       if (chemicalConsumption?.length)
//         log.chemicalConsumption = chemicalConsumption;
//       if (backwashTimings?.length) log.backwashTimings = backwashTimings;
//       if (runningHoursReading?.length)
//         log.runningHoursReading = runningHoursReading;

//       if (signOff?.length) {
//         signOff.forEach((entry) => {
//           const index = log.signOff.findIndex((s) => s.shift === entry.shift);
//           if (index !== -1) log.signOff[index] = entry;
//           else log.signOff.push(entry);
//         });
//       }

//       log.capacity = capacity;
//       await log.save();
//       return res.json(log);
//     } else {
//       const newLog = new DailyLog(req.body);
//       await newLog.save();
//       return res.status(201).json(newLog);
//     }
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// };

// exports.upsertDailyLog = async (req, res) => {
//   try {
//     const {
//       date,
//       username,
//       companyName,
//       timeEntries,
//       treatedWater,
//       remarks,
//       chemicalConsumption,
//       backwashTimings,
//       runningHoursReading,
//       signOff,
//       capacity,
//       flowReadings,
//     } = req.body;

//     const imageUrls = req.files?.map((file) => file.location) || [];

//     const [Y, M, D] = date.split("-").map(Number);
//     const utcMid = new Date(Date.UTC(Y, M - 1, D, 0, 0, 0));

//     const filter = {
//       companyName,
//       date: {
//         $gte: utcMid,
//         $lt: new Date(utcMid.getTime() + 24 * 60 * 60 * 1000),
//       },
//     };

//     const sumField = (arr, path) =>
//       arr.reduce((acc, shift) => {
//         const val = path.reduce((o, k) => (o ? o[k] : ""), shift);
//         const num = parseFloat(val || 0);
//         return !isNaN(num) ? acc + num : acc;
//       }, 0);

//     const flowTotals = {
//       inlet: {
//         initial: sumField(flowReadings, ["inlet", "initial"]).toString(),
//         final: sumField(flowReadings, ["inlet", "final"]).toString(),
//         total: sumField(flowReadings, ["inlet", "total"]).toString(),
//       },
//       outlet: {
//         initial: sumField(flowReadings, ["outlet", "initial"]).toString(),
//         final: sumField(flowReadings, ["outlet", "final"]).toString(),
//         total: sumField(flowReadings, ["outlet", "total"]).toString(),
//       },
//     };

//     const updateData = {
//       date: utcMid,
//       username,
//       companyName,
//       timeEntries,
//       treatedWater,
//       remarks,
//       chemicalConsumption,
//       backwashTimings,
//       runningHoursReading,
//       signOff,
//       capacity,
//       flowReadings,
//       flowTotals,
//       images: imageUrls,
//     };

//     const opts = { upsert: true, new: true, setDefaultsOnInsert: true };

//     const doc = await DailyLog.findOneAndUpdate(filter, updateData, opts);
//     return res.status(200).json(doc);
//   } catch (err) {
//     return res.status(500).json({ message: err.message });
//   }
// };

exports.upsertDailyLog = async (req, res) => {
  try {
    // ✅ Safely parse all JSON fields (they come as strings from FormData)
    const parseJSON = (data) => {
      try {
        return typeof data === "string" ? JSON.parse(data) : data;
      } catch (err) {
        return [];
      }
    };

    const { date, username, companyName, remarks, capacity } = req.body;

    const timeEntries = parseJSON(req.body.timeEntries);
    const treatedWater = parseJSON(req.body.treatedWater);
    const chemicalConsumption = parseJSON(req.body.chemicalConsumption);
    const backwashTimings = parseJSON(req.body.backwashTimings);
    const runningHoursReading = parseJSON(req.body.runningHoursReading);
    const signOff = parseJSON(req.body.signOff);
    const flowReadings = parseJSON(req.body.flowReadings);

    const imageUrls = req.files?.map((file) => file.location) || [];

    // Parse and prepare date filter
    const [Y, M, D] = date.split("-").map(Number);
    const utcMid = new Date(Date.UTC(Y, M - 1, D, 0, 0, 0));

    const filter = {
      companyName,
      date: {
        $gte: utcMid,
        $lt: new Date(utcMid.getTime() + 24 * 60 * 60 * 1000),
      },
    };

    // ✅ Safe sumField logic
    const sumField = (arr, path) =>
      Array.isArray(arr)
        ? arr.reduce((acc, shift) => {
            const val = path.reduce((o, k) => (o ? o[k] : ""), shift);
            const num = parseFloat(val || 0);
            return !isNaN(num) ? acc + num : acc;
          }, 0)
        : 0;

    const flowTotals = {
      inlet: {
        initial: sumField(flowReadings, ["inlet", "initial"]).toString(),
        final: sumField(flowReadings, ["inlet", "final"]).toString(),
        total: sumField(flowReadings, ["inlet", "total"]).toString(),
      },
      outlet: {
        initial: sumField(flowReadings, ["outlet", "initial"]).toString(),
        final: sumField(flowReadings, ["outlet", "final"]).toString(),
        total: sumField(flowReadings, ["outlet", "total"]).toString(),
      },
    };

    // ✅ Get existing log to merge previous images
    const existingLog = await DailyLog.findOne(filter);
    const previousImages = existingLog?.images || [];

    // ✅ Merge and deduplicate image URLs
    const allImages = Array.from(new Set([...previousImages, ...imageUrls]));

    const updateData = {
      date: utcMid,
      username,
      companyName,
      timeEntries,
      treatedWater,
      remarks,
      chemicalConsumption,
      backwashTimings,
      runningHoursReading,
      signOff,
      capacity,
      flowReadings,
      flowTotals,
      images: allImages,
    };

    const opts = { upsert: true, new: true, setDefaultsOnInsert: true };

    const doc = await DailyLog.findOneAndUpdate(filter, updateData, opts);

    // Return all images (if needed by frontend)
    res.status(200).json({ ...doc.toObject(), allImages });

  } catch (err) {
    console.error("Error in upsertDailyLog:", err);
    res.status(500).json({ message: err.message });
  }
};


exports.getDailyLogByCompanyAndDate = async (req, res) => {
  try {
    const { companyName, date } = req.params;

    // Ensure UTC boundaries for the given date
    const utcMid = new Date(Date.UTC(...date.split("-").map((v, i) => i === 1 ? Number(v) - 1 : Number(v))));
    const nextDay = new Date(utcMid.getTime() + 24 * 60 * 60 * 1000);

    // Find the main log
    const log = await DailyLog.findOne({
      companyName,
      date: { $gte: utcMid, $lt: nextDay },
    });

    if (!log) {
      return res.status(404).json({ message: "Log not found for that date" });
    }

    // Fetch all logs for that day and company to collect all uploaded images
    const allLogs = await DailyLog.find({
      companyName,
      date: { $gte: utcMid, $lt: nextDay },
    });

    const allImages = Array.from(
      new Set(allLogs.flatMap((log) => log.images || []))
    );

    return res.json({ ...log.toObject(), allImages });
  } catch (error) {
    console.error("Error in getDailyLogByCompanyAndDate:", error);
    res.status(500).json({ message: error.message });
  }
};