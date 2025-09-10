// S3Bucket/s3ElectricalReport
const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();
const BUCKET_NAME = 'ems-ebhoom-bucket';
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

module.exports = { getReportsFromS3, saveReportsToS3, saveReportToS3 };
