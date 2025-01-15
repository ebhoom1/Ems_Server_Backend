const Waste = require('../models/wasteModel');
const moment = require('moment');
const userdb = require('../models/user')


// Create waste data
exports.createWaste = async (req, res) => {
    const { userName, userType, stations } = req.body;

    try {
        // Map through stations to format the date and generate the time
        const processedStations = stations.map(station => ({
            ...station,
            date: moment(station.date, 'DD/MM/YYYY').format('DD/MM/YYYY'), // Ensure the date is in the correct format
            time: moment().format('HH:mm:ss') // Generate the current time
        }));

        // Check if there's already an entry for this userName on any of the provided dates
        for (const station of processedStations) {
            const existingEntry = await Waste.findOne({
                'userName': userName,
                'stations': { $elemMatch: { 'date': station.date } }
            });

            if (existingEntry) {
                return res.status(409).send({
                    message: `Entry for user ${userName} on date ${station.date} already exists.`
                });
            }
        }

        const waste = new Waste({ userName, userType, stations: processedStations });
        await waste.save();
        res.status(201).send(waste);
    } catch (error) {
        res.status(400).send(error);
    }
};


// Update waste data

// Update waste data


// Update waste data
// Update waste data
exports.updateWaste = async (req, res) => {
    const { id } = req.params;
    const { userName, stations } = req.body;

    try {
        const user = await userdb.findOne({ userName });
        if (!user) {
            return res.status(404).send('User not found');
        }

        const waste = await Waste.findById(id);
        if (!waste) {
            return res.status(404).send('Waste entry not found');
        }

        // If user type is 'user', compare the date of creation to the current date
        const currentDate = moment();
        const creationDate = moment(waste.createdAt);

        if (user.userType === 'user' && currentDate.diff(creationDate, 'days') > 0) {
            return res.status(403).send('Update period exceeded. Only admins can update after 24 hours from the creation date.');
        }

        // Map through stations to ensure each has a current time
        const updatedStations = stations.map(station => ({
            ...station,
            time: station.time ? station.time : moment().format('HH:mm:ss') // Set current time if not provided
        }));

        waste.stations = updatedStations;
        waste.updatedAt = moment().toDate();
        await waste.save();
        res.status(200).send(waste);
    } catch (error) {
        res.status(400).send(error);
    }
};


// Delete waste data
exports.deleteWaste = async (req, res) => {
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
exports.getWasteByUserName = async (req, res) => {
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
exports.getWasteByUserNameAndStationName = async (req, res) => {
    const { userName, stationName } = req.params; // Assume both parameters are passed via URL

    try {
        const wasteEntries = await Waste.find({
            userName,
            "stations.stationName": stationName  // Filter to match stationName within the stations array
        });

        if (wasteEntries.length === 0) {
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
exports.getAllWaste = async (req, res) => {
    try {
        const wastes = await Waste.find({});
        res.status(200).send(wastes);
    } catch (error) {
        res.status(400).send(error);
    }
};
