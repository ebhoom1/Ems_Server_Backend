const express = require('express');
const {createReport,findReport,findReportsByUserName,editReport,deletedReport,downloadReportAsPDF, downloadReportAsCSV } = require('../controllers/report');


const router = express.Router();

//Add a Report
router.post('/create-report', createReport);

//get All Report
router.get('/get-all-report',findReport);

//get a Report using userName
router.get('/get-a-report/:userName',findReportsByUserName);

//edit a Report 
router.patch('/edit-report/:userName',editReport);

//Delete a Report
router.delete('/delete-report/:userId',deletedReport);

//Download PDF Report
router.get('/report-download/pdf/:userId',downloadReportAsPDF);

//Download CSV Report
router.get('/report-download/csv/:userId',downloadReportAsCSV);

module.exports =router;

