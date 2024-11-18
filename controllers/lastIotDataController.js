const LastIotData = require('../models/LastIotData');



const saveOrUpdateLastEntryByUserName = async (data) => {
    try {
        const { _id, userName, ...updateData } = data; // Exclude _id from the update

        const updatedEntry = await LastIotData.findOneAndUpdate(
            { userName }, // Match by userName
            { 
                $set: { ...updateData, timestamp: new Date() } 
            },
            { upsert: true, new: true } // Create if not found, return updated document
        );

        console.log(`Latest data for ${userName} saved or updated.`);
        return updatedEntry;
    } catch (error) {
        console.error('Error saving or updating latest IoT data:', error);
        throw error;
    }
};




const getLatestDataByUserName = async (req, res) => {
    const { userName } = req.params;

    try {
        const data = await LastIotData.findOne({ userName });
        if (!data) {
            return res.status(404).json({
                success: false,
                message: `No latest IoT data found for userName ${userName}`,
            });
        }

        res.status(200).json({
            success: true,
            message: `Latest IoT data for userName ${userName} fetched successfully`,
            data,
        });
    } catch (error) {
        console.error('Error fetching latest IoT data:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching latest IoT data',
            error: error.message,
        });
    }  
};


module.exports = { saveOrUpdateLastEntryByUserName,getLatestDataByUserName };