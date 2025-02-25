const LastIotData = require('../models/LastIotData');

const saveOrUpdateLastEntryByUserName = async (data) => {
    console.log(`🔄 saveOrUpdateLastEntryByUserName FUNCTION CALLED`);
    try {
        const { _id, userName, timestamp, date, ...updateData } = data; // Exclude _id
        const newTimestamp = new Date(timestamp);
        const newDate = moment(date, "DD/MM/YYYY").toDate(); // Convert string date to a Date object

        console.log(`🔄 Received IoT data for ${userName} at ${newTimestamp.toISOString()} on ${date}`);

        // Fetch the latest entry from LastIotData
        const existingEntry = await LastIotData.findOne({ userName });

        if (existingEntry) {
            const existingTimestamp = new Date(existingEntry.timestamp);
            const existingDate = moment(existingEntry.date, "DD/MM/YYYY").toDate();

            // Debugging Logs
            console.log(`🛠 Debugging Update Process`);
            console.log(`New Timestamp: ${newTimestamp.toISOString()}`);
            console.log(`Existing Timestamp: ${existingTimestamp.toISOString()}`);
            console.log(`Time Difference (ms): ${newTimestamp - existingTimestamp}`);
            console.log(`New Date: ${moment(newDate).format("DD/MM/YYYY")}`);
            console.log(`Existing Date: ${moment(existingDate).format("DD/MM/YYYY")}`);
            console.log(`Date Comparison Result: ${moment(newDate).isSameOrBefore(existingDate)}`);

            if (newTimestamp <= existingTimestamp && moment(newDate).isSameOrBefore(existingDate)) {
                console.log(`⏳ New data is older or same as existing. Not updating.`);
                return existingEntry;
            }
        } else {
            console.log(`🆕 No existing entry found for ${userName}. Creating new entry.`);
        }

        // Ensure timestamp and date are stored correctly
        const updatedEntry = await LastIotData.findOneAndUpdate(
            { userName },
            {
                $set: {
                    ...updateData,
                    timestamp: newTimestamp,
                    date: moment(newDate).format("DD/MM/YYYY"),
                }
            },
            { upsert: true, new: true }
        );

        console.log(`✅ Latest IoT data for ${userName} saved/updated successfully.`);
        console.log(`🆕 Updated Data: ${JSON.stringify(updatedEntry, null, 2)}`);

        return updatedEntry;
    } catch (error) {
        console.error('❌ Error saving/updating latest IoT data:', error);
        throw error;
    }
};



const getLatestDataByUserName = async (req, res) => {
    const { userName } = req.params;

    try {
        console.log(`🔍 Fetching latest IoT data for ${userName}...`);
        
        // Fetch latest data based on timestamp
        const data = await LastIotData.findOne({ userName }).sort({ timestamp: -1 });

        if (!data) {
            console.log(`🚫 No latest IoT data found for ${userName}`);
            return res.status(404).json({
                success: false,
                message: `No latest IoT data found for ${userName}`,
            });
        }

        console.log(`✅ Latest IoT data fetched successfully for ${userName}.`);
        res.status(200).json({
            success: true,
            message: `Latest IoT data for ${userName} fetched successfully`,
            data,
        });
    } catch (error) {
        console.error('❌ Error fetching latest IoT data:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching latest IoT data',
            error: error.message,
        });
    }
};

module.exports = { saveOrUpdateLastEntryByUserName, getLatestDataByUserName };
