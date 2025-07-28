
// const MechanicalReport = require('../models/MechanicalReport'); // Ensure model is imported

// exports.addMechanicalReport = async (req, res) => {
//   console.log('--- multer files:', req.files);
//   console.log('--- form fields:', req.body);

//   try {
//     let territorialManager = null;
//     let columns = [];
//     let entries = [];

//     // Safely parse the territorialManager object from the form data
//     if (req.body.territorialManager) {
//       try {
//         territorialManager = JSON.parse(req.body.territorialManager);
//       } catch (jsonErr) {
//         console.error('❌ Manager JSON parse failed:', req.body.territorialManager, jsonErr);
//         return res.status(400).json({ success: false, message: 'Invalid territorialManager JSON' });
//       }
//     } else {
//       // This check is important for your 'required: true' schema rule
//       return res.status(400).json({ success: false, message: 'Territorial Manager is required.' });
//     }

//     // Safely parse columns array
//     if (req.body.columns) {
//       try {
//         columns = JSON.parse(req.body.columns);
//       } catch (jsonErr) {
//         console.error('❌ Columns JSON parse failed:', req.body.columns, jsonErr);
//         return res.status(400).json({ success: false, message: 'Invalid columns JSON' });
//       }
//     }

//     // Safely parse entries array
//     if (req.body.entries) {
//       try {
//         entries = JSON.parse(req.body.entries);
//       } catch (jsonErr) {
//         console.error('❌ Entries JSON parse failed:', req.body.entries, jsonErr);
//         return res.status(400).json({ success: false, message: 'Invalid entries JSON' });
//       }
//     }

//     // Get photo URLs from S3 upload
//     const photoUrls = (req.files || []).map(file => file.location);

//     // Transform entries to match the sub-schema structure
//     let transformedEntries = [];
//     if (req.body.isWorking === 'yes' && entries.length) {
//       transformedEntries = entries.map(entry => ({
//         id: entry.id,
//         category: entry.category,
//         description: entry.description,
//         checks: Array.isArray(entry.checks)
//           ? entry.checks.map((val, idx) => ({
//               column: columns[idx] || '',
//               value: val
//             }))
//           : [],
//         remarks: entry.remarks || ''
//       }));
//     }

//     // Create a new report document using the Mongoose model
//     const report = new MechanicalReport({
//       equipmentId:        req.body.equipmentId,
//       equipmentName:      req.body.equipmentName,
//       userName:           req.body.userName,
//       capacity:           req.body.capacity,
//       columns,
//       territorialManager, // Use the parsed manager object
//       entries:            transformedEntries,
//       timestamp:          req.body.timestamp,
//       isWorking:          req.body.isWorking,
//       comments:           req.body.comments,
//       photos:             photoUrls
//     });

//     // Save the document to the database
//     await report.save();

//     // Send a success response
//     return res.json({ success: true, report });

//   } catch (err) {
//     // Catch any errors during the process (e.g., database validation)
//     console.error('🔴 Error in addMechanicalReport:', err.stack || err);
//     return res.status(500).json({ success: false, message: 'Server error saving report' });
//   }
// };


// exports.getReportsByEquipment = async (req, res) => {
//   try {
//     const { equipmentId } = req.params;
//     const reports = await MechanicalReport.find({ equipmentId });
//     if (!reports.length) {
//       return res.json({ success: false, message: 'No report found.' });
//     }
//     // Since we already stored URLs, there’s no Buffer conversion here
//     res.json({ success: true, reports });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ success: false, message: 'Server error' });
//   }
// };

// exports.getMechanicalReports = async (req, res) => {
//   try {
//     const reports = await MechanicalReport.find({});
//     res.json({ success: true, reports });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ success: false, message: 'Server error' });
//   }
// };

// /* exports.getReportsByMonth = async (req, res) => {
//   try {
//     const year  = parseInt(req.params.year,  10);
//     const month = parseInt(req.params.month, 10);
//     if (isNaN(year)|| isNaN(month) || month<1||month>12) {
//       return res.status(400).json({ success:false, message:'Invalid year/month' });
//     }
//     const start = new Date(year, month-1, 1);
//     const end   = new Date(year, month,   1);
//     const reports = await MechanicalReport
//       .find({ timestamp:{ $gte:start, $lt:end } })
//       .sort({ timestamp:-1 });
//     res.json({ success: true, reports });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ success: false, message: 'Server error' });
//   }
// }; */
// exports.getReportsByUserAndMonth = async (req, res) => {
//   console.log(
//     '>>> HIT getReportsByUserAndMonth →',
//     'userName=', req.params.userName,
//     'year=', req.params.year,
//     'month=', req.params.month
//   );
//   try {
//     const year     = parseInt(req.params.year,  10);
//     const month    = parseInt(req.params.month, 10);
//     const { userName } = req.params;

//     if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
//       return res
//         .status(400)
//         .json({ success: false, message: 'Invalid year or month' });
//     }

//     // build start/end of month
//     const start = new Date(year, month - 1, 1);
//     const end   = new Date(year, month,     1);

//     // query by userName and timestamp range
//     const reports = await MechanicalReport.find({
//       userName,
//       timestamp: { $gte: start, $lt: end }
//     }).sort({ timestamp: -1 });

//     if (!reports.length) {
//       return res.json({ success: false, message: 'No reports found.' });
//     }

//     res.json({ success: true, reports });
//   } catch (err) {
//     console.error('Error in getReportsByUserAndMonth:', err);
//     res.status(500).json({ success: false, message: 'Server error' });
//   }
// };

// //chcek if exist 
// // controllers/mechanicalReportController.js



// exports.checkMechanicalReportExists = async (req, res) => {
//   try {
//     const { equipmentId } = req.params;
//     const { year, month } = req.query;

//     if (!year || !month) {
//       return res.status(400).json({
//         success: false,
//         message: "Year and month query parameters are required.",
//       });
//     }

//     // Create a robust UTC date range for the query
//     const startDate = new Date(Date.UTC(year, month - 1, 1));
//     const endDate = new Date(Date.UTC(year, month, 1)); // Start of the *next* month

//     const query = {
//       equipmentId: equipmentId,
//       // ✨ FINAL FIX: Change 'reportDate' to 'timestamp' to match your database
//       timestamp: {
//         $gte: startDate,
//         $lt: endDate,
//       },
//     };

//     const report = await MechanicalReport.findOne(query);

//     return res.json({ success: true, exists: !!report });

//   } catch (err) {
//     console.error('Error in checkMechanicalReportExists:', err);
//     res.status(500).json({ 
//         success: false, 
//         message: 'Server error while checking mechanical report.' 
//     });
//   }
// };

// //update
// // Add this new function to your controller file

// exports.updateMechanicalReport = async (req, res) => {
//   console.log('--- updating report, fields:', req.body);
//   try {
//     const { reportId } = req.params;
//     const report = await MechanicalReport.findById(reportId);

//     if (!report) {
//       return res.status(404).json({ success: false, message: 'Report not found' });
//     }

//     // Safely parse incoming data (similar to addMechanicalReport)
//     let territorialManager = req.body.territorialManager ? JSON.parse(req.body.territorialManager) : report.territorialManager;
//     let columns = req.body.columns ? JSON.parse(req.body.columns) : report.columns;
//     let entries = req.body.entries ? JSON.parse(req.body.entries) : report.entries;

//     // Get new photo URLs and combine with any existing ones if needed
//     const newPhotoUrls = (req.files || []).map(file => file.location);
//     // Note: You might want logic to remove old photos. For simplicity, we'll just add new ones.
//     const allPhotos = [...report.photos, ...newPhotoUrls];

//     // Transform entries to match the sub-schema structure
//     let transformedEntries = [];
//     if (req.body.isWorking === 'yes' && entries.length) {
//       transformedEntries = entries.map(entry => ({
//         id: entry.id,
//         category: entry.category,
//         description: entry.description,
//         checks: Array.isArray(entry.checks)
//           ? entry.checks.map((val, idx) => ({
//               column: columns[idx] || '',
//               value: val
//             }))
//           : [],
//         remarks: entry.remarks || ''
//       }));
//     }

//     // Update the report fields
//     report.territorialManager = territorialManager;
//     report.columns = columns;
//     report.entries = transformedEntries;
//     report.isWorking = req.body.isWorking;
//     report.comments = req.body.comments;
//     report.photos = allPhotos;
//     report.timestamp = req.body.timestamp; // Update the timestamp to reflect the edit time

//     // Save the updated document
//     await report.save();

//     return res.json({ success: true, report });

//   } catch (err) {
//     console.error('🔴 Error in updateMechanicalReport:', err.stack || err);
//     return res.status(500).json({ success: false, message: 'Server error updating report' });
//   }
// };


const MechanicalReport = require('../models/MechanicalReport'); // Ensure model is imported

exports.addMechanicalReport = async (req, res) => {
    console.log('--- multer files:', req.files);
    console.log('--- form fields:', req.body);

    try {
        let territorialManager = null;
        let columns = [];
        let entries = [];

        // Safely parse the territorialManager object from the form data
        if (req.body.territorialManager) {
            try {
                territorialManager = JSON.parse(req.body.territorialManager);
            } catch (jsonErr) {
                console.error('❌ Manager JSON parse failed:', req.body.territorialManager, jsonErr);
                return res.status(400).json({ success: false, message: 'Invalid territorialManager JSON' });
            }
        } else {
            return res.status(400).json({ success: false, message: 'Territorial Manager is required.' });
        }

        // Safely parse columns array
        if (req.body.columns) {
            try {
                columns = JSON.parse(req.body.columns);
            } catch (jsonErr) {
                console.error('❌ Columns JSON parse failed:', req.body.columns, jsonErr);
                return res.status(400).json({ success: false, message: 'Invalid columns JSON' });
            }
        }

        // Safely parse entries array
        if (req.body.entries) {
            try {
                entries = JSON.parse(req.body.entries);
            } catch (jsonErr) {
                console.error('❌ Entries JSON parse failed:', req.body.entries, jsonErr);
                return res.status(400).json({ success: false, message: 'Invalid entries JSON' });
            }
        }

        // Get photo URLs from S3 upload (these are new uploads)
        const newPhotoUrls = (req.files || []).map(file => file.location);

        // Transform entries to match the sub-schema structure
        let transformedEntries = [];
        if (req.body.isWorking === 'yes' && entries.length) {
            transformedEntries = entries.map(entry => ({
                id: entry.id,
                category: entry.category,
                description: entry.description,
                checks: Array.isArray(entry.checks)
                    ? entry.checks.map((val, idx) => ({
                        column: columns[idx] || '',
                        value: val
                    }))
                    : [],
                remarks: entry.remarks || ''
            }));
        }

        // Determine current month and year for upsert logic
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1; // JS months are 0-11
        const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
        const endOfMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59);

        // Find existing report for the current month and equipment
        let existingReport = await MechanicalReport.findOne({
            equipmentId: req.body.equipmentId,
            timestamp: { $gte: startOfMonth, $lt: endOfMonth }
        });

        let report;
        if (existingReport) {
            // Update existing report
            existingReport.equipmentName = req.body.equipmentName;
            existingReport.userName = req.body.userName;
            existingReport.capacity = req.body.capacity;
            existingReport.columns = columns;
            existingReport.territorialManager = territorialManager;
            existingReport.entries = transformedEntries;
            existingReport.timestamp = new Date(); // Update timestamp to current time
            existingReport.isWorking = req.body.isWorking;
            existingReport.comments = req.body.comments;
            existingReport.photos = [...existingReport.photos, ...newPhotoUrls]; // Add new photos to existing ones

            report = await existingReport.save();
            console.log('Mechanical report updated successfully:', report._id);
        } else {
            // Create a new report document
            report = new MechanicalReport({
                equipmentId: req.body.equipmentId,
                equipmentName: req.body.equipmentName,
                userName: req.body.userName,
                capacity: req.body.capacity,
                columns,
                territorialManager,
                entries: transformedEntries,
                timestamp: new Date(), // Set timestamp to current time
                isWorking: req.body.isWorking,
                comments: req.body.comments,
                photos: newPhotoUrls
            });
            await report.save();
            console.log('Mechanical report created successfully:', report._id);
        }

        return res.json({ success: true, report });

    } catch (err) {
        console.error('🔴 Error in addMechanicalReport (upsert):', err.stack || err);
        return res.status(500).json({ success: false, message: 'Server error saving/updating report' });
    }
};


exports.getReportsByEquipment = async (req, res) => {
    try {
        const { equipmentId } = req.params;
        const reports = await MechanicalReport.find({ equipmentId });
        if (!reports.length) {
            return res.json({ success: false, message: 'No report found.' });
        }
        res.json({ success: true, reports });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.getMechanicalReports = async (req, res) => {
    try {
        const reports = await MechanicalReport.find({});
        res.json({ success: true, reports });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.getReportsByUserAndMonth = async (req, res) => {
    console.log(
        '>>> HIT getReportsByUserAndMonth →',
        'userName=', req.params.userName,
        'year=', req.params.year,
        'month=', req.params.month
    );
    try {
        const year = parseInt(req.params.year, 10);
        const month = parseInt(req.params.month, 10);
        const { userName } = req.params;

        if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
            return res
                .status(400)
                .json({ success: false, message: 'Invalid year or month' });
        }

        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 1);

        const reports = await MechanicalReport.find({
            userName,
            timestamp: { $gte: start, $lt: end }
        }).sort({ timestamp: -1 });

        if (!reports.length) {
            return res.json({ success: false, message: 'No reports found.' });
        }

        res.json({ success: true, reports });
    } catch (err) {
        console.error('Error in getReportsByUserAndMonth:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.checkMechanicalReportExists = async (req, res) => {
    try {
        const { equipmentId } = req.params;
        const { year, month } = req.query;

        if (!year || !month) {
            return res.status(400).json({
                success: false,
                message: "Year and month query parameters are required.",
            });
        }

        const startDate = new Date(Date.UTC(year, month - 1, 1));
        const endDate = new Date(Date.UTC(year, month, 1));

        const query = {
            equipmentId: equipmentId,
            timestamp: {
                $gte: startDate,
                $lt: endDate,
            },
        };

        const report = await MechanicalReport.findOne(query);

        return res.json({ success: true, exists: !!report });

    } catch (err) {
        console.error('Error in checkMechanicalReportExists:', err);
        res.status(500).json({
            success: false,
            message: 'Server error while checking mechanical report.'
        });
    }
};

// NEW: Get a specific mechanical report for an equipment by month and year
exports.getMechanicalReportByEquipmentAndMonth = async (req, res) => {
    try {
        const { equipmentId } = req.params;
        const { year, month } = req.query;

        if (!year || !month) {
            return res.status(400).json({
                success: false,
                message: "Year and month query parameters are required.",
            });
        }

        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        const report = await MechanicalReport.findOne({
            equipmentId: equipmentId,
            timestamp: {
                $gte: startDate,
                $lt: endDate,
            },
        });

        if (!report) {
            return res.status(404).json({ success: false, message: 'Report not found for this equipment and month.' });
        }

        return res.json({ success: true, report });

    } catch (err) {
        console.error("Error fetching report by equipment and month:", err);
        return res.status(500).json({
            success: false,
            message: "Server error while fetching report by equipment and month.",
        });
    }
};

// The updateMechanicalReport function is no longer strictly needed if addMechanicalReport handles upsert.
// However, if you have other use cases for it, you can keep it.
// For this specific monthly report use case, `addMechanicalReport` will now serve both purposes.