const CalibrationExceeded = require('../models/calibrationExceed');
const User = require('../models/user');
const Report = require('../models/report');
const moment = require('moment-timezone');
const PDFDocument = require('pdfkit');
const { Parser } = require('json2csv');
const fs = require('fs');

// Create Report

const createReport = async (req, res) => {
    const { 
      userName, 
      industryType, 
      companyName, 
      fromDate, 
      toDate, 
      engineerName, 
      reportApproved, 
      stackName 
    } = req.body;
  
    try {
      // Helper function to parse 'dd-mm-yyyy' with UTC timezone handling
      const parseDate = (dateString) => {
        return moment.tz(dateString, 'DD-MM-YYYY', 'UTC').startOf('day').toDate();
      };
  
      console.log("Received Dates:", fromDate, toDate); // Debugging log
  
      const start = parseDate(fromDate); // Start of the day
      const end = moment.tz(toDate, 'DD-MM-YYYY', 'UTC').endOf('day').toDate(); // End of the same day
  
      console.log("Parsed Start and End Dates (UTC):", start, end); // Debugging log
  
      // Construct the query object
      const query = { 
        userName, 
        industryType, 
        companyName, 
        stackName, 
        timestamp: { $gte: start, $lte: end } 
      };
  
      // Fetch calibration exceeds from MongoDB
      const calibrationExceeds = await CalibrationExceeded.find(query).sort({ timestamp: -1 });
  
      if (!calibrationExceeds || calibrationExceeds.length === 0) {
        return res.status(404).json({ success: false, message: 'No exceeds found' });
      }
  
      // Extract and format exceedances
      const exceedances = calibrationExceeds.map((exceed) => ({
        parameter: exceed.parameter,
        value: exceed.value,
        stackName: exceed.stackName,
        formattedDate: moment(exceed.timestamp).format('DD/MM/YYYY'), // Format as 'dd/mm/yyyy'
        formattedTime: moment(exceed.timestamp).format('HH:mm:ss'), // Extract time in 'HH:MM:SS'
        message: exceed.message
      }));
  
      console.log('Exceedances:', exceedances); // Debugging log
  
      // Create the report
      const report = new Report({
        userName,
        industryType,
        companyName,
        fromDate,
        toDate,
        engineerName,
        stackName,
        calibrationExceeds: exceedances,
        reportApproved
      });
  
      await report.save();
  
      res.status(201).json({
        status: 201,
        success: true,
        message: 'Report Created Successfully',
        report
      });
    } catch (error) {
      console.error('Error creating report:', error);
      res.status(500).json({
        status: 500,
        success: false,
        message: 'Error in creating report',
        error: error.message
      });
    }
  };
  


//Find all the report

const findReport = async (req,res)=>{
    try {
        const report =await Report.find();
        
        if(!report){
            return res.status(404).json({
                
                message:'Report Not Found', 
            })
            
        }
        res.status(200).json({
            status:200,
            success:true,
            message:'All reports are fetched',
            report,
          })
    } catch (error) {
        res.status(500).json({
            status:500,
            success:true,
            message:'Internal server error',
            error:error.message
          })
    }
}

// Find reports by userName

const findReportsByUserName=async(req,res)=>{
    try {
        const userName =req.params.userName

        const reports = await Report.find({userName})
        if(reports.length === 0){
            return res.status(404).json({
                message:"No Reports found for this USER"
            })
        }
        res.status(200).json({
            status:200,
            success:true,
            message:'Report fetched successfully',
            reports
        })
    } catch (error) {
        res.status(500).json({
            status:500,
            success:true,
            message:'Internal server error',
            error:error.message
          })
          
    }
}

// Edit a report  
const editReport = async(req,res)=>{
    try {
        const {userName} =req.params;
        const updatedFields = req.body

        const updateReport =await Report.findOneAndUpdate({userName:userName},updatedFields,{new:true})

        if(!updateReport){
            return res.status(404).json({message:'Report not found'})
        }
        res.status(200).json({
            status:200,
            success:true,
            message:'Report updated successfully',
            reports:updateReport
        })
    } catch (error) {
        res.status(500).json({
            status:500,
            success:true,
            message:'Error in Edit your Report',
            error:error.message
          })
    }
}

//Delete a report

const deletedReport = async(req,res)=>{
    try{
        const { userId }  =req.params

        const deleteReport =await Report.findByIdAndDelete(userId);
        
        if(!deleteReport){
            return res.status(404).json({message:'Report not found'})
        }
        res.status(200).json({
            status:200,
            succes:true,
            message:'Report Deleted Successfully',
            deletedReport
        })
    }catch(error){
        res.status(500).json({
            status:500,
            success:false,
            message:'Error in Deleting report',
            error:error.message
          })
    }
}

const generatePDF = (report, res) => {
    const doc = new PDFDocument({ margin: 30 });

    // Pipe the PDF document to the response
    doc.pipe(res);

    // Header: Report Details
    doc.fontSize(16).text('Report Details', { align: 'center', underline: true });

    // Move down and display the basic report details
    doc.moveDown();
    doc.fontSize(12).text(`Industry Type: ${report.industryType}`);
    doc.text(`Company Name: ${report.companyName}`);
    doc.text(`Stack Name: ${report.stackName}`);
    doc.text(`From Date: ${report.fromDate}`);
    doc.text(`To Date: ${report.toDate}`);
    doc.text(`Engineer Name: ${report.engineerName}`);
    doc.text(`User Name: ${report.userName}`);
    doc.text(`Report Approved: ${report.reportApproved ? 'Approved' : 'Denied'}`);

    doc.moveDown(); 

    // Calibration Exceeds Table Header
    doc.fontSize(14).text('Calibration Exceeds', { underline: true, align: 'left' });

    // Draw table column headers
    doc.moveDown();
    const headers = ['Parameter', 'Value', 'Date', 'Time', 'Message'];
    drawTableHeaders(doc, headers);

    // Iterate over exceedances and render them in rows
    report.calibrationExceeds.forEach((exceed, index) => {
        drawTableRow(doc, [
            exceed.parameter,
            exceed.value,
            exceed.formattedDate,
            exceed.formattedTime,
            exceed.message,
        ]);
    });

    doc.end(); // Finalize the PDF and send it
};

// Helper function to draw table headers
const drawTableHeaders = (doc, headers) => {
    headers.forEach((header, i) => {
        doc
            .fontSize(12)
            .text(header, 72 + i * 100, doc.y, { width: 90, align: 'left' });
    });
    doc.moveDown();
    doc.moveTo(70, doc.y).lineTo(520, doc.y).stroke(); // Draw a line under the headers
};

// Helper function to draw a table row
const drawTableRow = (doc, row) => {
    row.forEach((cell, i) => {
        doc
            .fontSize(10)
            .text(cell, 72 + i * 100, doc.y, { width: 90, align: 'left' });
    });
    doc.moveDown();
    doc.moveTo(70, doc.y).lineTo(520, doc.y).stroke(); // Draw a line after each row
};


//Function to generate CSV
const generateCSV = (report,res)=>{
    const fields = [
        'industryType', 'companyName', 'fromDate', 'toDate', 'engineerName', 'userName','stackName', 'reportApproved'
    ];
    const calibrationFields =[
        'parameter','value','formattedDate', 'formattedTime', 'message'
    ];

    const csvParser =new Parser({fields});
    const csvCalibrationParser = new Parser({fields: calibrationFields})

    const csvData = csvParser.parse(report)

    let csvCalibrationData = '';
    report.calibrationExceeds.forEach((exceed,index)=>{
        csvCalibrationData += csvCalibrationParser.parse(exceed) +'/n';

    })
    res.header('Content-Type','text/csv');
    res.attachment('report.csv');
    res.send(`${csvData}\n\nCalibration Exceeds:\n ${csvCalibrationData}`);

}

//Download Report as PDF

const downloadReportAsPDF =async(req,res)=>{
    try {
        const {userId} = req.params
        const report = await Report.findById(userId);
        if(!report){
            return res.status(404).json({message:'Report not found'});
        }

        res.header('Content-Type','application/pdf');
        res.attachment('report.pdf');
        generatePDF(report,res);
    } catch (error) {
        res.status(500).json({
            status:500,
            success:false,
            message:'Error downloading report',
            error:error.message
        })
    }
}

//Download report as CSV

const downloadReportAsCSV = async (req,res) =>{
    try {
        const {userId} = req.params
        const report =await Report.findById(userId);
        
        if(!report){
            return res.stauts(404).json({
                message:'Report not found'
            })
        }
        generateCSV(report,res);
    } catch (error) {
        res.status(500).json({
            status:500,
            success:false,
            message:'Erro Downloading Report',
            error:error.message
        })
    }
}

module.exports = {createReport,findReport,findReportsByUserName,editReport,deletedReport,downloadReportAsPDF,downloadReportAsCSV};
