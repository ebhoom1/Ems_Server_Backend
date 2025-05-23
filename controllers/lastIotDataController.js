const LastIotData = require('../models/LastIotData');
const moment = require('moment');

const saveOrUpdateLastEntryByUserName = async (data) => {
    console.log(`🔄 saveOrUpdateLastEntryByUserName FUNCTION CALLED`);

    try {
        const {
            _id,
            userName,
            timestamp,
            date,
            time,
            stacks = [],
            ...otherFields
        } = data;

        if (stacks.length === 0) {
            console.warn(`⚠️ No 'stacks' data provided for ${userName}, skipping.`);
            return null;
        }

        const primaryStationType = stacks[0].stationType;
        if (!primaryStationType) {
            console.warn(`⚠️ No 'stationType' found in the first stack for ${userName}, skipping.`);
            console.log(`Incoming data.stacks[0]:`, JSON.stringify(stacks[0], null, 2)); // Add this
            return null;
        }

        // Add this log to confirm the extracted stationType
        console.log(`🔎 Extracted primaryStationType: ${primaryStationType}`);

        const newTimestamp = new Date(timestamp);
        const formattedDate = moment(date, "DD/MM/YYYY").format("DD/MM/YYYY");

        console.log(
            `🔄 Received data for ${userName} / ${primaryStationType} ` +
            `at ${newTimestamp.toISOString()} (date ${formattedDate})`
        );

        const filter = { userName, stationType: primaryStationType };

        // Add this log to confirm the filter being used
        console.log(`🔍 MongoDB findOneAndUpdate filter:`, filter);

        const update = {
            $set: {
                userName: userName,
                stationType: primaryStationType, // THIS IS CRUCIAL
                product_id: otherFields.product_id,
                stackData: stacks,
                date: formattedDate,
                time: time,
                companyName: otherFields.companyName,
                industryType: otherFields.industryType,
                mobileNumber: otherFields.mobileNumber,
                email: otherFields.email,
                timestamp: newTimestamp,
                validationMessage: otherFields.validationMessage,
                validationStatus: otherFields.validationStatus,
            }
        };

        // Add this log to confirm the update payload
        console.log(`📝 MongoDB findOneAndUpdate update ($set part):`, JSON.stringify(update.$set, null, 2));


        const opts = { upsert: true, new: true };

        const existingEntry = await LastIotData.findOne(filter);
        if (existingEntry) {
            console.log(`👀 Existing entry found for filter:`, JSON.stringify(existingEntry, null, 2));
            const existingTimestamp = new Date(existingEntry.timestamp);

            console.log(`🛠 Debugging Update Process for ${userName}/${primaryStationType}`);
            console.log(`New Timestamp: ${newTimestamp.toISOString()}`);
            console.log(`Existing Timestamp: ${existingTimestamp.toISOString()}`);
            console.log(`Time Difference (ms): ${newTimestamp - existingTimestamp}`);

            if (newTimestamp <= existingTimestamp) {
                console.log(`⏳ New data for ${userName}/${primaryStationType} is older or same as existing. Not updating.`);
                return existingEntry;
            }
        } else {
            console.log(`🆕 No existing entry found for ${userName}/${primaryStationType}. Creating new entry.`);
        }

        const updatedEntry = await LastIotData.findOneAndUpdate(filter, update, opts);

        console.log(`✅ Latest IoT data for ${userName}/${primaryStationType} saved/updated successfully.`);
        console.log(`🆕 Updated Data (from DB): ${JSON.stringify(updatedEntry, null, 2)}`);

        return updatedEntry;

    } catch (error) {
        console.error('❌ Error saving/updating latest IoT data:', error);
        console.error('Data that caused error:', JSON.stringify(data, null, 2)); // Log the problematic data
        throw error;
    }
};

// ... (getLatestDataByUserName remains the same)

const getLatestDataByUserName = async (req, res) => {
  const { userName } = req.params;
  console.log(`🔍 GET /api/latest/${userName} hit`);

  try {
    // Use .find() to retrieve all documents matching the userName,
    // as there will now be multiple documents (one per stationType).
    // Sorting by timestamp will order the array by the latest update across all stationTypes.
    const data = await LastIotData.find(
      { userName },
      null,                           // projection → all fields
      { sort: { timestamp: -1 } }    // options → newest overall update first
    )
    .lean(); // returns a plain JS object, slightly faster

    if (!data || data.length === 0) {
      console.log(`🚫 No latest IoT data found for ${userName}`);
      return res.status(404).json({
        success: false,
        message: `No latest IoT data found for ${userName}`,
      });
    }

    console.log(`✅ Latest IoT data fetched for ${userName}:`, data);
    // 'data' will be an array of documents, each representing the last update for a specific stationType
    return res.status(200).json({
      success: true,
      message: `Latest IoT data for ${userName} fetched successfully (all stationTypes)`,
      data,
    });
  } catch (err) {
    console.error('❌ Error in getLatestDataByUserName:', err.stack);
    return res.status(500).json({
      success: false,
      message: 'Error fetching latest IoT data',
      error: err.message,
    });
  }
};

module.exports = { saveOrUpdateLastEntryByUserName, getLatestDataByUserName };