// S3Bucket/s3ElectricalReport
const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();
const BUCKET_NAME = 'goodfoot-ems-bucket';
const FILE_KEY = 'electrical_reports/reports.json';

// Fetch all reports from S3
async function getReportsFromS3() {
  try {
    const file = await s3.getObject({ Bucket: BUCKET_NAME, Key: FILE_KEY }).promise();
    return JSON.parse(file.Body.toString('utf-8'));
  } catch (err) {
    if (err.code === 'NoSuchKey') return []; // file not created yet
    throw err;
  }
}

// Save all reports back to S3
async function saveReportsToS3(reports) {
  const params = {
    Bucket: BUCKET_NAME,
    Key: FILE_KEY,
    Body: JSON.stringify(reports, null, 2),
    ContentType: 'application/json',
  };
  await s3.upload(params).promise();
}

// Append a new report
async function saveReportToS3(newReport) {
  const reports = await getReportsFromS3();
  reports.push({ ...newReport, _id: Date.now().toString(), createdAt: new Date() });
  await saveReportsToS3(reports);
  return reports[reports.length - 1];
}



/**
 * Deletes reports from S3 based on matching criteria.
 * @param {object} criteria - The criteria to match for deletion.
 * @param {string} criteria.userName - The user name to match.
 * @param {string} criteria.date - The date to match (in 'YYYY-MM-DD' format).
 * @param {string} [criteria.equipmentId] - (Optional) The equipment ID to match.
 * @returns {Promise<{deletedCount: number}>} - The number of reports deleted.
 */
async function deleteReportsFromS3(criteria) {
  const { userName, date, equipmentId } = criteria;
  
  // 1. Fetch all current reports
  const allReports = await getReportsFromS3();
  const initialCount = allReports.length;

  // 2. Filter the reports, keeping only the ones that DO NOT match the criteria
  const reportsToKeep = allReports.filter(report => {
    // Check if the date part of the 'createdAt' timestamp matches the provided date
    const reportDate = report.createdAt.substring(0, 10); // Extracts 'YYYY-MM-DD' from '2025-06-25T09:33:19.590Z'
    
    const isUserMatch = report.userName === userName;
    const isDateMatch = reportDate === date;
    
    // If equipmentId is provided, it must also match. Otherwise, we ignore it.
    const isEquipmentMatch = !equipmentId || report.equipmentId === equipmentId;

    // We want to delete if all conditions match. So, we KEEP the report if any condition is FALSE.
    // The filter keeps items that return 'true'. So we return 'false' for items we want to remove.
    return !(isUserMatch && isDateMatch && isEquipmentMatch);
  });

  // 3. If any reports were filtered out, save the new array back to S3
  if (reportsToKeep.length < initialCount) {
    await saveReportsToS3(reportsToKeep);
  }

  const deletedCount = initialCount - reportsToKeep.length;
  return { deletedCount };
}
module.exports = { getReportsFromS3, saveReportsToS3, saveReportToS3 ,deleteReportsFromS3};
