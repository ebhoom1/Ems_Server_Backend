const moment = require('moment');
const IotData = require('../models/iotData'); // Adjust the path as needed

const getDataForRange = async (startDate, endDate) => {
    return await IotData.aggregate([
        {
            $match: {
                timestamp: { 
                    $gte: new Date(startDate), 
                    $lte: new Date(endDate) 
                }
            }
        },
        { $unwind: '$stackData' }, // Unwind stack data for individual values
        {
            $group: {
                _id: {
                    date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
                    field: '$stackData.sensorName' // Group by sensor name if present
                },
                averageValue: { $avg: '$stackData.value' }, // Average value
                count: { $sum: 1 }
            }
        },
        { $sort: { '_id.date': 1 } } // Sort by date
    ]);
};

const getSensorData = async (req, res) => {
    try {
        const { range } = req.query; // Range from request (day, week, month, etc.)
        let startDate;
        const endDate = moment().endOf('day').toDate(); // Current day end

        switch (range) {
            case 'day':
                startDate = moment().startOf('day').toDate();
                break;
            case 'week':
                startDate = moment().subtract(7, 'days').startOf('day').toDate();
                break;
            case 'month':
                startDate = moment().subtract(1, 'month').startOf('day').toDate();
                break;
            case 'sixMonth':
                startDate = moment().subtract(6, 'months').startOf('day').toDate();
                break;
            case 'year':
                startDate = moment().subtract(1, 'year').startOf('day').toDate();
                break;
            default:
                return res.status(400).json({ success: false, message: 'Invalid range' });
        }

        const data = await getDataForRange(startDate, endDate);
        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('Error fetching sensor data:', error);
        res.status(500).json({ success: false, message: 'Error fetching data', error: error.message });
    }
};

module.exports = { getSensorData };
