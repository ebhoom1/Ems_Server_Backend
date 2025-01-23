const cron = require('node-cron');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
const puppeteer = require('puppeteer');
const calibrationExceedValues = require('../../models/calibrationExceedValues');
const MinandMax = require('../../models/MinandMax');
const ConsumptionData = require('../../models/ConsumptionData');
const User = require('../../models/user');

// Nodemailer configuration
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD,
    },
});

// AWS SDK configuration
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

// Fetch the last average data for each stack from S3
const fetchLastAverageDataFromS3 = async () => {
    try {
        const params = {
            Bucket: 'ems-ebhoom-bucket',
            Key: 'average_data/averageData.json',
        };
        const data = await s3.getObject(params).promise();
        const allData = JSON.parse(data.Body.toString('utf-8'));

        // Extract only the last entered data for each user and stack
        const latestData = {};
        allData.forEach(entry => {
            entry.stackData.forEach(stack => {
                if (['energy', 'effluent_flow', 'waste', 'generator'].includes(stack.stationType)) return;

                const key = `${entry.userName}_${stack.stackName}`;
                if (!latestData[key] || new Date(entry.timestamp.$date) > new Date(latestData[key].timestamp.$date)) {
                    latestData[key] = { ...entry, stackData: [stack] };
                }
            });
        });

        return Object.values(latestData);
    } catch (error) {
        console.error('Error fetching average data from S3:', error);
        throw error;
    }
};

// Fetch the last entered MinandMax data for a stack
const fetchLastMinandMaxData = async (userName, stackName) => {
    try {
        const minMaxData = await MinandMax.findOne({ userName, stackName }).sort({ timestamp: -1 });

        if (!minMaxData) {
            console.warn(`No MinandMax data found for user: ${userName}, stack: ${stackName}`);
            return { minValues: {}, maxValues: {} };
        }

        // Extract and return properly formatted data
        return {
            minValues: minMaxData.minValues || {},
            maxValues: minMaxData.maxValues || {},
        };
    } catch (error) {
        console.error('Error fetching MinandMax data:', error);
        return { minValues: {}, maxValues: {} };
    }
};

// Generate water table
const generateWaterTable = (stackName, parameters, exceedance, maxMinData) => {
    const rows = Object.entries(parameters).map(([param, value]) => {
        const minValue = 0; // Always set to 0
        const maxValue = 0; // Always set to 0
        const minAcceptable = exceedance?.[`${param}Min`] || 'Not Added';
        const maxAcceptable = exceedance?.[`${param}Max`] || 'Not Added';
        const exceedanceValue = exceedance?.[param] || 'Not Added';

        return `
        <tr>
            <td>${param}</td>
            <td>${value || 0}</td>
            <td>${minValue}</td>
            <td>${maxValue}</td>
            <td>${minAcceptable}</td>
            <td>${maxAcceptable}</td>
            <td>${exceedanceValue}</td>
        </tr>`;
    }).join('');

    return `
        <h2 style="color: #236a80; font-size: 1.5rem;">Quality Report for Station: ${stackName}</h2>
        <table class="report-table">
            <thead>
                <tr>
                    <th>Parameter</th>
                    <th>Avg Value</th>
                    <th>Min Value</th>
                    <th>Max Value</th>
                    <th>Min Acceptable Limits</th>
                    <th>Max Acceptable Limits</th>
                    <th>Exceedance</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;
};

// Fetch the last difference data from S3
const fetchLastDifferenceDataFromS3 = async () => {
    try {
        const params = {
            Bucket: 'ems-ebhoom-bucket',
            Key: 'difference_data/hourlyDifferenceData.json',
        };
        const data = await s3.getObject(params).promise();
        const allData = JSON.parse(data.Body.toString('utf-8'));

        // Extract only the last entered data for each user and stack
        const latestData = {};
        allData.forEach(entry => {
            const key = `${entry.userName}_${entry.stackName}`;
            if (!latestData[key] || new Date(entry.timestamp) > new Date(latestData[key].timestamp)) {
                latestData[key] = entry;
            }
        });

        return Object.values(latestData);
    } catch (error) {
        console.error('Error fetching difference data from S3:', error);
        throw error;
    }
};

// Generate energy and flow tables
const generateEnergyAndFlowTables = async (userName) => {
    const consumptionData = await ConsumptionData.findOne({ userName }).sort({ createdAt: -1 });
    const differenceData = await fetchLastDifferenceDataFromS3();

    let energyTable = '<p>No energy data available.</p>';
    let flowTable = '<p>No flow data available.</p>';

    if (consumptionData) {
        const energyData = consumptionData.totalConsumptionData
            .filter(item => item.stationType === 'energy' && !['effluent_flow', 'waste', 'generator'].includes(item.stationType))
            .map(item => {
                const difference = differenceData.find(d => d.stackName === item.stackName && d.stationType === 'energy') || {};
                return {
                    stackName: item.stackName,
                    total: item.energy || 0,
                    initialEnergy: difference.initialEnergy || 'nil',
                    lastEnergy: difference.lastEnergy || 'nil',
                    energyDifference: difference.energyDifference || 'nil',
                };
            });

        energyTable = `
            <h1 style="color:rgb(2, 37, 37); font-size: 2rem; text-align: center; margin-top: 30px; text-decoration: underline;">Energy Report</h1>
            <table class="report-table">
                <thead>
                    <tr>
                        <th>Station</th>
                        <th>Total Consumption</th>
                        <th>Initial Reading</th>
                        <th>Final Reading</th>
                        <th>Difference</th>
                    </tr>
                </thead>
                <tbody>
                    ${energyData.map(data => `
                        <tr>
                            <td>${data.stackName}</td>
                            <td>${data.total}</td>
                            <td>${data.initialEnergy}</td>
                            <td>${data.lastEnergy}</td>
                            <td>${data.energyDifference}</td>
                        </tr>`).join('')}
                </tbody>
            </table>`;

        const flowData = consumptionData.totalConsumptionData
            .filter(item => item.stationType === 'effluent_flow' && !['energy', 'waste', 'generator'].includes(item.stationType))
            .map(item => {
                const difference = differenceData.find(d => d.stackName === item.stackName && d.stationType === 'effluent_flow') || {};
                return {
                    stackName: item.stackName,
                    total: item.finalflow || 0,
                    initialFlow: difference.initialCumulatingFlow || 'nil',
                    lastFlow: difference.lastCumulatingFlow || 'nil',
                    flowDifference: difference.cumulatingFlowDifference || 'nil',
                };
            });

        flowTable = `
            <h1 style="color:rgb(2, 37, 37); font-size: 2rem; text-align: center; margin-top: 30px; text-decoration: underline;">Flow Report</h1>
            <table class="report-table">
                <thead>
                    <tr>
                        <th>Station</th>
                        <th>Total Flow</th>
                        <th>Initial Reading</th>
                        <th>Final Reading</th>
                        <th>Difference</th>
                    </tr>
                </thead>
                <tbody>
                    ${flowData.map(data => `
                        <tr>
                            <td>${data.stackName}</td>
                            <td>${data.total}</td>
                            <td>${data.initialFlow}</td>
                            <td>${data.lastFlow}</td>
                            <td>${data.flowDifference}</td>
                        </tr>`).join('')}
                </tbody>
            </table>`;
    }

    return { energyTable, flowTable };
};

// Generate combined PDF content
const generateCombinedPDFContent = async (companyName, waterTables, userName) => {
    const { energyTable, flowTable } = await generateEnergyAndFlowTables(userName);

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .report-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                }
                .report-table th, .report-table td {
                    border: 1px solid #ddd;
                    text-align: center;
                    padding: 8px;
                }
                .report-table th {
                    background-color: #236a80;
                    color: white;
                }
            </style>
        </head>
        <body>
            <h1 style="text-align: center; color:rgb(2, 37, 37);">Report for ${companyName}</h1>
            ${waterTables}
            ${energyTable}
            ${flowTable}
        </body>
        </html>`;
};

// Generate PDF
const generatePDF = async (htmlContent, filePath) => {
    try {
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
        await page.pdf({ path: filePath, format: 'A4', printBackground: true });
        await browser.close();
        console.log(`PDF generated: ${filePath}`);
        return filePath;
    } catch (error) {
        console.error('Error generating PDF:', error);
        throw error;
    }
};

// Generate and send report
const generateAndSendReport = async (user) => {
    try {
        const { companyName, email, userName } = user;
        const averageData = await fetchLastAverageDataFromS3();
        const userAverageData = averageData.filter(entry => entry.userName === userName);

        if (!userAverageData.length) {
            console.warn(`No average data found for user: ${userName}`);
            return;
        }

        const waterTables = await Promise.all(userAverageData.map(async entry => {
            return Promise.all(entry.stackData.map(async stack => {
                if (['energy', 'effluent_flow', 'waste', 'generator'].includes(stack.stationType)) return '';
                const maxMinData = await fetchLastMinandMaxData(userName, stack.stackName);
                const exceedance = await calibrationExceedValues.findOne({ userName }).lean();

                return generateWaterTable(stack.stackName, stack.parameters, exceedance, maxMinData);
            }));
        }));

        const combinedWaterTables = waterTables.flat().filter(Boolean).join('');
        const htmlContent = await generateCombinedPDFContent(companyName, combinedWaterTables, userName);

        const dir = path.join(__dirname, 'PDFs');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);

        const filePath = path.join(dir, `${userName}.pdf`);
        await generatePDF(htmlContent, filePath);

        await sendEmail(email, filePath);
    } catch (error) {
        console.error('Error generating or sending report:', error);
    }
};

// Send email with the generated PDF
const sendEmail = async (email, pdfPath) => {
    try {
        const mailOptions = {
            from: 'Daily Report <iot@example.com>',
            to: email,
            subject: 'Daily Report',
            text: 'Please find attached the daily report.',
            attachments: [{ filename: path.basename(pdfPath), path: pdfPath }],
        };
        await transporter.sendMail(mailOptions);
        console.log(`Email sent to: ${email}`);
    } catch (error) {
        console.error(`Error sending email to ${email}:`, error);
    }
};

// Schedule daily reports
const scheduleDailyReports = () => {
    cron.schedule('40 1 * * *', async () => {
        console.log('Cron job triggered');

        const users = await User.find();

        for (const user of users) {
            await generateAndSendReport(user);
        }
    }, {
        timezone: 'Asia/Kolkata',
    });
};


module.exports = { scheduleDailyReports };
