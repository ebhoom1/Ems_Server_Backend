
const Waste = require('../models/wasteAndGeneratorModel');
const moment = require('moment');
const userdb = require('../models/user');

// Create waste data
exports.createWasteAndGenerator = async (req, res) => {
    const { userName, userType, stations, dataType } = req.body;

    try {
        // Map through stations to format the date and generate the time
        const processedStations = stations.map(station => ({
            ...station,
            date: moment(station.date, 'DD/MM/YYYY').format('DD/MM/YYYY'), // Ensure the date is in the correct format
            time: moment().format('HH:mm:ss') // Generate the current time
        }));

        // Check if there's already an entry for this userName and dataType on any of the provided dates
        for (const station of processedStations) {
            const existingEntry = await Waste.findOne({
                userName,
                dataType,
                'stations': { $elemMatch: { 'date': station.date } }
            });

            if (existingEntry) {
                return res.status(409).send({
                    message: `Entry for ${dataType} data for user ${userName} on date ${station.date} already exists.`
                });
            }
        }

        const waste = new Waste({ userName, userType, stations: processedStations, dataType });
        await waste.save();
        res.status(201).send(waste);
    } catch (error) {
        res.status(400).send(error);
    }
};

exports.updateWasteAndGenerator = async (req, res) => {
    const { id } = req.params;
    const { stations } = req.body;

    try {
        // Find the waste entry by ID
        const waste = await Waste.findById(id);
        if (!waste) {
            return res.status(404).send('Waste entry not found');
        }

        // Update the stations directly, assuming all validation and user authentication are handled elsewhere
        const updatedStations = stations.map(station => ({
            ...station,
            time: station.time ? station.time : moment().format('HH:mm:ss') // Ensure time is set to current if not provided
        }));

        waste.stations = updatedStations;
        waste.updatedAt = moment().toDate(); // Update the 'updatedAt' timestamp
        await waste.save(); // Save the updated waste document

        res.status(200).send(waste); // Send the updated waste data back to the client
    } catch (error) {
        console.error('Failed to update waste data:', error);
        res.status(400).send(error); // Send an error response if something goes wrong
    }
};

// Delete waste data
exports.deleteWasteAndGenerator = async (req, res) => {
    const { id } = req.params;
    try {
        const waste = await Waste.findByIdAndDelete(id);
        if (!waste) {
            return res.status(404).send('Waste entry not found');
        }
        res.status(200).send('Waste entry deleted successfully');
    } catch (error) {
        res.status(400).send(error);
    }
};

// Get waste by userName
exports.getWasteAndGeneratorByUserName = async (req, res) => {
    const { userName } = req.params;
    try {
        const wasteEntries = await Waste.find({ userName });
        if (!wasteEntries.length) {
            return res.status(404).send('No waste entries found for this user');
        }
        res.status(200).send(wasteEntries);
    } catch (error) {
        res.status(400).send(error);
    }
};

// Get waste by userName and stationName
exports.getWasteAndGeneratorByUserNameAndStationName = async (req, res) => {
    const { userName, stationName } = req.params;

    try {
        const wasteEntries = await Waste.find({
            userName,
            "stations.stationName": stationName
        });

        if (!wasteEntries.length) {
            return res.status(404).send('No waste entries found for this user and station');
        }

        // Optionally, filter to only return the relevant stations' data
        const filteredEntries = wasteEntries.map(entry => ({
            ...entry._doc,
            stations: entry.stations.filter(station => station.stationName === stationName)
        }));

        res.status(200).send(filteredEntries);
    } catch (error) {
        res.status(400).send(error);
    }
};

// Get all waste entries
exports.getAllWasteAndGenerator = async (req, res) => {
    try {
        const wastes = await Waste.find({});
        res.status(200).send(wastes);
    } catch (error) {
        res.status(400).send(error);
    }
};