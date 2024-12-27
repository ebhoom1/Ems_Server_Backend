// Import required modules
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const User = require('../../models/user');
const averageData = require('../../models/averageData');
const calibrationExceedValues = require('../../models/calibrationExceedValues');
const MaxMinData = require('../../models/MaxMinData');
const IotData = require('../../models/iotData');
const pdf = require('html-pdf');
const ConsumptionData = require('../../models/ConsumptionData');
const DifferenceData = require('../../models/differeneceData');

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

// Helper to generate water quality table
// Helper to generate water quality table
const generateWaterTable = (stackName, waterParameters) => {
    return `
        <h2 style="color: #236a80; font-size: 1.5rem; text-align: left; margin-top: 20px; border-bottom: 2px solid #ddd;">Quality Report for Station: ${stackName}</h2>
        <table class="report-table">
            <thead>
                <tr>
                    <th>Parameter</th>
                    <th>Avg Value</th>
                    <th>Min Value</th>
                    <th>Max Value</th>
                    <th>Min Acceptable Limits</th>
                    <th>Max Acceptable Limits</th>
                </tr>
            </thead>
            <tbody>
                ${Object.entries(waterParameters).map(([param, data]) => `
                    <tr>
                        <td>${param}</td>
                        <td>${data.avg}</td>
                        <td>${data.min}</td>
                        <td>${data.max}</td>
                        <td>${data.minAcceptable}</td>
                        <td>${data.maxAcceptable}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
};

// Helper to generate combined PDF content
const generateCombinedPDFContent = (companyName, waterTables, energyData, qualityData) => {
    const energyTable = energyData.length ? `
        <h1 style="color: #1a73e8; font-size: 2rem; text-align: center; margin-top: 30px; text-decoration: underline;">Energy Report</h1>
        <table class="report-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Unit</th>
                    <th>Total</th>
                    <th>Initial Meter Reading</th>
                    <th>Final Meter Reading</th>
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
                        <td>kWh</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    ` : '<p style="color: #ff6f61; text-align: center; font-size: 1.2rem; margin-top: 20px;">No energy data available.</p>';

    const qualityTable = qualityData.length ? `
        <h1 style="color: #1a73e8; font-size: 2rem; text-align: center; margin-top: 30px; text-decoration: underline;">Quality Report</h1>
        <table class="report-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Total</th>
                    <th>Initial Meter Reading</th>
                    <th>Final Meter Reading</th>
                    <th>Difference</th>
                </tr>
            </thead>
            <tbody>
                ${qualityData.map(data => `
                    <tr>
                        <td>${data.stackName}</td>
                        <td>${data.total}</td>
                        <td>${data.initialFlow}</td>
                        <td>${data.lastFlow}</td>
                        <td>${data.flowDifference}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    ` : '<p style="color: #ff6f61; text-align: center; font-size: 1.2rem; margin-top: 20px;">No quanitity data available.</p>';

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Combined Report</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f9f9f9; }
                .report-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 20px 0;
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
                .report-table tbody tr:nth-child(even) {
                    background-color: #f2f2f2;
                }
                .report-table tbody tr:hover {
                    background-color: #e0f7fa;
                }
            </style>
        </head>
        <body>
            <h1 style="color: #0d47a1; font-size: 2.5rem; text-align: center; margin-bottom: 40px;">Report for ${companyName}</h1>
            ${waterTables}
            ${energyTable}
            ${qualityTable}
        </body>
        </html>
    `;
};


// Helper to generate a PDF file
const generatePDF = (htmlContent, filePath) => {
    return new Promise((resolve, reject) => {
        pdf.create(htmlContent).toFile(filePath, (err, res) => {
            if (err) return reject(err);
            resolve(res.filename);
        });
    });
};

// Generate PDF for a user
const generatePDFForUser = async (companyName, userName, stackNames, industryType) => {
    if (!stackNames || stackNames.length === 0) {
        console.warn(`No stack names for user: ${userName}`);
        return null;
    }

    try {
        const waterTables = [];
        let energyData = [];
        let qualityData = [];

        // Fetch Energy and Quality data
        const consumptionDataDoc = await ConsumptionData.findOne({ userName }).sort({ createdAt: -1 });
        const differenceDataDoc = await DifferenceData.find({ userName }).sort({createdAt: -1});

        if (consumptionDataDoc) {
            energyData = consumptionDataDoc.totalConsumptionData
                .filter(item => item.stationType === 'energy')
                .map(item => {
                    const difference = differenceDataDoc.find(d => d.stackName === item.stackName) || {};
                    return {
                        stackName: item.stackName,
                        total: item.energy || 0,
                        initialEnergy: difference.initialEnergy || 0,
                        lastEnergy: difference.lastEnergy || 0,
                        energyDifference: difference.energyDifference || 0,
                    };
                });

            qualityData = consumptionDataDoc.totalConsumptionData
                .filter(item => item.stationType === 'effluent_flow')
                .map(item => {
                    const difference = differenceDataDoc.find(d => d.stackName === item.stackName) || {};
                    return {
                        stackName: item.stackName,
                        total: item.finalflow || 0,
                        initialFlow: difference.initialCumulatingFlow || 0,
                        lastFlow: difference.lastCumulatingFlow || 0,
                        flowDifference: difference.cumulatingFlowDifference || 0,
                    };
                });
        }

        // Generate Water Quality tables for each stack excluding energy and effluent_flow types
        for (const stackName of stackNames) {
            const iotDataDoc = await IotData.findOne({ userName, 'stackData.stackName': stackName.name }).sort({ createdAt: -1 });
            const minMaxDataDoc = await MaxMinData.findOne({ userName, stackName: stackName.name }).sort({ createdAt: -1 });
            const calibrationDataDoc = await calibrationExceedValues.findOne({ industryType }).sort({ createdAt: -1 });

            if (!iotDataDoc || !iotDataDoc.stackData) continue;

            const stack = iotDataDoc.stackData.find(s => s.stackName === stackName.name && s.stationType !== 'energy' && s.stationType !== 'effluent_flow');
            if (!stack) continue;

            const waterParameters = Object.keys(stack.toObject()).reduce((result, key) => {
                if (key !== '_id' && key !== 'stackName' && key !== 'stationType') {
                    result[key] = {
                        avg: stack[key] || 0,
                        min: minMaxDataDoc?.minValues?.[key] || 0,
                        max: minMaxDataDoc?.maxValues?.[key] || 0,
                        minAcceptable: key === 'ph' ? calibrationDataDoc?.phBelow || 0 : 0,
                        maxAcceptable: calibrationDataDoc?.[key] || calibrationDataDoc?.phAbove || 0,
                    };
                }
                return result;
            }, {});

            waterTables.push(generateWaterTable(stackName.name, waterParameters));
        }

        const combinedWaterTables = waterTables.join('') || '<p style="color: #ff6f61; text-align: center; font-size: 1.2rem; margin-top: 20px;">No quality data available.</p>';

        const htmlContent = generateCombinedPDFContent(companyName, combinedWaterTables, energyData, qualityData);

        const dir = path.join(__dirname, 'PDFs');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const filePath = path.join(dir, `${userName}.pdf`);
        await generatePDF(htmlContent, filePath);
        console.log(`PDF generated: ${filePath}`);
        return filePath;

    } catch (error) {
        console.error(`Error generating PDF for user: ${userName}: ${error.message}`);
        return null;
    }
};

// Send email with PDFs
const sendEmail = async (userEmail, pdfFiles) => {
    try {
        const attachments = pdfFiles.filter(fs.existsSync).map(file => ({
            filename: path.basename(file),
            path: file,
        }));

        if (attachments.length === 0) {
            console.warn(`No valid PDF files to send for ${userEmail}`);
            return;
        }

        const mailOptions = {
            from: 'Daily Report <iot@example.com>',
            to: userEmail,
            subject: 'Daily Water Quality Report',
            text: 'Please find attached the daily water quality reports.',
            attachments,
        };

        await transporter.sendMail(mailOptions);
        console.log(`Email sent to: ${userEmail}`);
    } catch (error) {
        console.error(`Error sending email to ${userEmail}: ${error.message}`);
    }
};

// Schedule daily reports
// const scheduleDailyReports = () => {
//     cron.schedule('55 23 * * *', async () => { //55 23
//         console.log('Cron job triggered at:', new Date());
//         fs.writeFileSync(path.join(__dirname, 'cron.log'), `Triggered at: ${new Date()}\n`, { flag: 'a' });
//         try {
//             const users = await User.find();

//             for (const user of users) {
//                 const { companyName, userName, stackName, industryType, email, userType } = user;

//                 if (userType === 'admin') {
//                     console.log(`Skipping admin user: ${userName}`);
//                     continue;
//                 }

//                 if (!stackName || stackName.length === 0) {
//                     console.warn(`No stack names found for user: ${userName}. Skipping.`);
//                     continue;
//                 }

//                 const pdfPath = await generatePDFForUser(companyName, userName, stackName, industryType);
//                 if (pdfPath) await sendEmail(email, [pdfPath]);
//             }
//         } catch (error) {
//             console.error('Error in daily report generation:', error.message);
//         }
//     });
// };

// Schedule daily reports
const scheduleDailyReports = () => {
    cron.schedule('0 * * * *', {
        scheduled: true,
        timezone: 'Asia/Kolkata', // Set your timezone here
    }, async () => {
        console.log('Cron job triggered at:', new Date());
        try {
            const users = await User.find();
            for (const user of users) {
                const { companyName, userName, stackName, industryType, email, userType } = user;

                if (userType === 'admin') {
                    console.log(`Skipping admin user: ${userName}`);
                    continue;
                }

                if (!stackName || stackName.length === 0) {
                    console.warn(`No stack names found for user: ${userName}. Skipping.`);
                    continue;
                }

                const pdfPath = await generatePDFForUser(companyName, userName, stackName, industryType);
                if (pdfPath) await sendEmail(email, [pdfPath]);
            }
        } catch (error) {
            console.error('Error in daily report generation:', error.message);
        }
    });
};

module.exports = { scheduleDailyReports };