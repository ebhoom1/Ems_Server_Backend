// Import the PrimaryStation model
const PrimaryStation = require('../models/PrimaryStation');

// Set up primary station and emit real-time updates
exports.setPrimaryStation = async (req, res) => {
    try {
        const { userName, stationType, stackName } = req.body;
        const filter = { userName, stationType };
        const update = { stackName };
        const options = { new: true, upsert: true };

        // Create or update primary station in the database
        const primaryStation = await PrimaryStation.findOneAndUpdate(filter, update, options);

        // Send the response to the client
        res.status(201).send({
            message: primaryStation ? 'Primary station updated successfully' : 'Primary station created successfully',
            data: primaryStation
        });

        // Emit real-time update to a specific room based on userName
        req.io.to(userName).emit('primaryStationUpdate', {
            message: 'Primary station data updated',
            data: primaryStation,
            timestamp: new Date()
        });
        console.log(`Real-time update emitted for primary station of user ${userName}`);
    } catch (error) {
        res.status(500).send({ message: 'Failed to set or update primary station', error: error.message });
    }
};

// Retrieve primary station (no Socket.io listener here)
exports.getPrimaryStation = async (req, res) => {
    try {
        const { userName } = req.params;

        // Find the primary station in the database
        const primaryStation = await PrimaryStation.findOne({ userName });

        if (!primaryStation) {
            return res.status(404).send({
                message: 'No primary station found for the provided userName.'
            });
        }

        // Send the response to the client
        res.send({
            message: 'Primary station retrieved successfully',
            data: primaryStation
        });

        // Emit real-time data to the specific user room
        req.io.to(userName).emit('primaryStationRetrieved', {
            message: 'Primary station data retrieved',
            data: primaryStation,
            timestamp: new Date()
        });
        console.log(`Real-time data emitted for primary station retrieval of user ${userName}`);
    } catch (error) {
        res.status(500).send({ message: 'Failed to retrieve primary station', error: error.message });
    }
};
