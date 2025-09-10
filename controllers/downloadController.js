const { Parser } = require("json2csv");
const PumpData = require("../models/PumpData");
const TankData = require("../models/tankData");

/**
 * @desc    Download pump metrics data as a CSV file.
 * @route   GET /api/download/pump-metrics
 * @access  Public
 */
const downloadPumpData = async (req, res) => {
  try {
    // Fetch all pump data from the database.
    // .lean() is used for performance improvement as it returns plain JS objects.
    const pumpMetrics = await PumpData.find({}).lean();

    if (!pumpMetrics || pumpMetrics.length === 0) {
      return res.status(404).json({ message: "No pump metrics data found." });
    }

    // Define the fields for the CSV file based on your Mongoose schema.
    const fields = [
      "product_id",
      "userName",
      "pumpId",
      "pumpName",
      "timestamp",
      "vrn",
      "vyn",
      "vbn",
      "vry",
      "vyb",
      "vbr",
      "red_phase_current",
      "yellow_phase_current",
      "blue_phase_current",
      "temperature",
      "vibration",
      "rpm",
      "status",
      "fault",
      "createdAt",
      "updatedAt"
    ];

    // Create a new CSV parser.
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(pumpMetrics);

    // Set the headers to trigger a file download in the browser.
    res.header("Content-Type", "text/csv");
    res.attachment("pump-metrics-data.csv");
    return res.send(csv);

  } catch (error) {
    console.error("Error generating pump metrics CSV:", error);
    res.status(500).send("Error generating CSV file.");
  }
};

/**
 * @desc    Download tank data as a CSV file.
 * @route   GET /api/download/tank-data
 * @access  Public
 */
const downloadTankData = async (req, res) => {
  try {
    const tankRecords = await TankData.find({}).lean();

    if (!tankRecords || tankRecords.length === 0) {
      return res.status(404).json({ message: "No tank data found." });
    }

    // Since tankData is a nested array, we need to flatten the structure.
    const flattenedData = [];
    tankRecords.forEach(record => {
      if (record.tankData && Array.isArray(record.tankData)) {
        record.tankData.forEach(tank => {
          flattenedData.push({
            product_id: record.product_id,
            userName: record.userName,
            companyName: record.companyName,
            recordTimestamp: record.timestamp, // Main record timestamp
            stackName: tank.stackName,
            tankName: tank.tankName,
            level: tank.level,
            percentage: tank.percentage,
          });
        });
      }
    });

    if (flattenedData.length === 0) {
       return res.status(404).json({ message: "No individual tank entries found to export." });
    }

    // Define the fields for the flattened data.
    const fields = [
      "product_id",
      "userName",
      "companyName",
      "recordTimestamp",
      "stackName",
      "tankName",
      "level",
      "percentage",
    ];
    
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(flattenedData);

    res.header("Content-Type", "text/csv");
    res.attachment("tank-data.csv");
    return res.send(csv);

  } catch (error) {
    console.error("Error generating tank data CSV:", error);
    res.status(500).send("Error generating CSV file.");
  }
};


module.exports = {
    downloadPumpData,
    downloadTankData
};
