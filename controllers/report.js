const CalibrationExceeded = require('../models/calibrationExceed');
const User = require('../models/user');
const Report = require('../models/report');
const moment = require('moment-timezone');
const PDFDocument = require('pdfkit');
const { Parser } = require('json2csv');
const fs = require('fs');
const AWS = require('aws-sdk');
const pdf = require('html-pdf');

// Create Report

// Configure AWS SDK
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
  });
  
  const s3 = new AWS.S3();
  
  const createReport = async (req, res) => {
    const {
      userName,
      industryType,
      companyName,
      fromDate,
      toDate,
      engineerName,
      reportApproved,
      stackName,
    } = req.body;
  
    try {
      const parseDate = (dateString) => {
        return moment.tz(dateString, 'DD-MM-YYYY', 'UTC').startOf('day').toDate();
      };
  
      const start = parseDate(fromDate);
      const end = moment.tz(toDate, 'DD-MM-YYYY', 'UTC').endOf('day').toDate();
  
      // Fetch data from MongoDB
      const mongoData = await CalibrationExceeded.find({
        userName,
        industryType,
        companyName,
        stackName,
        timestamp: { $gte: start, $lte: end },
      }).lean();
  
      // Fetch data from S3
      const s3Params = {
        Bucket: 'ems-ebhoom-bucket',
        Key: 'parameterExceed_data/exceedData.json',
      };
  
      let s3Data = [];
      try {
        const s3File = await s3.getObject(s3Params).promise();
        const s3FileData = JSON.parse(s3File.Body.toString('utf-8'));
  
        // Filter S3 data by date range
        s3Data = s3FileData.filter(
          (item) =>
            new Date(item.timestamp) >= start && new Date(item.timestamp) <= end
        );
      } catch (err) {
        if (err.code !== 'NoSuchKey') {
          throw err;
        }
      }
  
      // Combine MongoDB and S3 data
      const combinedData = [...mongoData, ...s3Data];
  
      if (combinedData.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: 'No exceeds found' });
      }
  
      // Format the combined data
      const exceedances = combinedData.map((exceed) => ({
        parameter: exceed.parameter,
        value: exceed.value,
        stackName: exceed.stackName,
        formattedDate: moment(exceed.timestamp).format('DD/MM/YYYY'),
        formattedTime: moment(exceed.timestamp).format('HH:mm:ss'),
        message: exceed.message,
      }));
  
      // Create and save the report
      const report = new Report({
        userName,
        industryType,
        companyName,
        fromDate,
        toDate,
        engineerName,
        stackName,
        calibrationExceeds: exceedances,
        reportApproved,
      });
  
      await report.save();
  
      res.status(201).json({
        status: 201,
        success: true,
        message: 'Report Created Successfully',
        report,
      });
    } catch (error) {
      console.error('Error creating report:', error);
      res.status(500).json({
        status: 500,
        success: false,
        message: 'Error in creating report',
        error: error.message,
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

// const generatePDF = (report, res) => {
//     const doc = new PDFDocument({ margin: 30 });

//     // Pipe the PDF document to the response
//     doc.pipe(res);

//     // Header: Report Details
//     doc.fontSize(16).text('Report Details', { align: 'center', underline: true });

//     // Move down and display the basic report details
//     doc.moveDown();
//     doc.fontSize(12).text(`Industry Type: ${report.industryType}`);
//     doc.text(`Company Name: ${report.companyName}`);
//     doc.text(`Stack Name: ${report.stackName}`);
//     doc.text(`From Date: ${report.fromDate}`);
//     doc.text(`To Date: ${report.toDate}`);
//     doc.text(`Engineer Name: ${report.engineerName}`);
//     doc.text(`User Name: ${report.userName}`);
//     doc.text(`Report Approved: ${report.reportApproved ? 'Approved' : 'Denied'}`);

//     doc.moveDown(); 

//     // Calibration Exceeds Table Header
//     doc.fontSize(14).text('Calibration Exceeds', { underline: true, align: 'left' });

//     // Draw table column headers
//     doc.moveDown();
//     const headers = ['Parameter', 'Value', 'Date', 'Time', 'Message'];
//     drawTableHeaders(doc, headers);

//     // Iterate over exceedances and render them in rows
//     report.calibrationExceeds.forEach((exceed, index) => {
//         drawTableRow(doc, [
//             exceed.parameter,
//             exceed.value,
//             exceed.formattedDate,
//             exceed.formattedTime,
//             exceed.message,
//         ]);
//     });

//     doc.end(); // Finalize the PDF and send it
// };

// // Helper function to draw table headers
// const drawTableHeaders = (doc, headers) => {
//     headers.forEach((header, i) => {
//         doc
//             .fontSize(12)
//             .text(header, 72 + i * 100, doc.y, { width: 90, align: 'left' });
//     });
//     doc.moveDown();
//     doc.moveTo(70, doc.y).lineTo(520, doc.y).stroke(); // Draw a line under the headers
// };

// // Helper function to draw a table row
// const drawTableRow = (doc, row) => {
//     row.forEach((cell, i) => {
//         doc
//             .fontSize(10)
//             .text(cell, 72 + i * 100, doc.y, { width: 90, align: 'left' });
//     });
//     doc.moveDown();
//     doc.moveTo(70, doc.y).lineTo(520, doc.y).stroke(); // Draw a line after each row
// };


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

// Helper to generate HTML content for the report
const generateHTMLContentForReport = (report) => {
    const exceedancesTable = report.calibrationExceeds.map((exceed) => `
      <tr>
        <td>${exceed.parameter}</td>
        <td>${exceed.value}</td>
        <td>${exceed.formattedDate}</td>
        <td>${exceed.formattedTime}</td>
        <td>${exceed.message}</td>
        <td>${exceed.commentByUser|| ''}</td>
        <td>${exceed.commentByAdmin|| ''}</td>
      </tr>
    `).join('');
  
    const approvalStatus = report.reportApproved
      ? `<span style="
          display: inline-block;
          padding: 10px;
          color: #fff;
          background-color: #28a745;
          border-radius: 5px;
          font-weight: bold;
          ">Approved</span>`
      : `<span style="
          display: inline-block;
          padding: 10px;
          color: #fff;
          background-color: #dc3545;
          border-radius: 5px;
          font-weight: bold;
          ">Declined</span>`;
  
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <title>Report PDF</title>
          <style>
              body { font-family: Arial, sans-serif; margin: 20px; background-color: #f9f9f9; }
              h1 { color: #0d47a1; text-align: center; }
              h2 { color: #236a80; text-align: left; }
              p { font-size: 1rem; margin: 5px 0; }
              .company-name { font-size: 1.5rem; font-weight: bold; color: #1a73e8; }
              table {
                  width: 100%;
                  border-collapse: collapse;
                  margin: 20px 0;
              }
              table, th, td {
                  border: 1px solid #ddd;
              }
              th, td {
                  text-align: left;
                  padding: 8px;
              }
              th {
                  background-color: #236a80;
                  color: white;
              }
              tr:nth-child(even) {
                  background-color: #f2f2f2;
              }
          </style>
      </head>
      <body>
          <h1>Report Details</h1>
          <p class="company-name">${report.companyName}</p>
          <p><strong>Industry Type:</strong> ${report.industryType}</p>
          <p><strong>Station Name:</strong> ${report.stackName}</p>
          <p><strong>From Date:</strong> ${report.fromDate}</p>
          <p><strong>To Date:</strong> ${report.toDate}</p>
          <p><strong>Engineer Name:</strong> ${report.engineerName}</p>
          <p><strong>User Name:</strong> ${report.userName}</p>
          <p><strong>Report Approved:</strong> ${approvalStatus}</p>
          <h2>Calibration Exceeds</h2>
          <table>
              <thead>
                  <tr>
                      <th>Parameter</th>
                      <th>Value</th>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Message</th>
                      <th>Comment By User</th>
                      <th>Comment By Admin</th>
                  </tr>
              </thead>
              <tbody>
                  ${exceedancesTable}
              </tbody>
          </table>
      </body>
      </html>
    `;
  };
  

//Download Report as PDF

// Updated downloadReportAsPDF function
const downloadReportAsPDF = async (req, res) => {
    try {
      const { userId } = req.params;
      const report = await Report.findById(userId);
  
      if (!report) {
        return res.status(404).json({ message: 'Report not found' });
      }
  
      // Generate HTML content for the report
      const htmlContent = generateHTMLContentForReport(report);
  
      // Generate PDF from the HTML content
      const options = { format: 'A4', orientation: 'portrait', border: '10mm' };
      pdf.create(htmlContent, options).toStream((err, stream) => {
        if (err) {
          console.error('Error generating PDF:', err);
          return res.status(500).json({ message: 'Error generating PDF' });
        }
  
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=report-${userId}.pdf`);
        stream.pipe(res);
      });
    } catch (error) {
      res.status(500).json({
        status: 500,
        success: false,
        message: 'Error downloading report',
        error: error.message,
      });
    }
  };

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
