// reportGenerator.js

const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
const nodemailer = require("nodemailer");
const puppeteer = require("puppeteer");
const { generateWaterTable, generateCombinedPDFContent } = require("./reportTemplate");
const { fetchLastAverageDataFromS3, fetchLastMinandMaxData, fetchConsumptionData, fetchEnergyAndFlowData  } = require("./fetchData");
const User = require("../../models/user");

// Nodemailer configuration
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD,
    },
});

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

// Send email
const sendEmail = async (email, pdfPath) => {
    try {
        const mailOptions = {
            from: "Daily Report <iot@example.com>",
            to: email,
            subject: "Daily Report",
            text: "Please find attached the daily report.",
            attachments: [{ filename: path.basename(pdfPath), path: pdfPath }],
        };
        await transporter.sendMail(mailOptions);
        console.log(`Email sent to: ${email}`);
    } catch (error) {
        console.error(`Error sending email to ${email}:`, error);
    }
};

// Generate and send report

const generateAndSendReport = async (user) => {
    try {
        if (!user || !user.companyName || !user.email || !user.userName) {
            console.warn("Invalid user data:", user);
            return;
        }

        console.log(`Generating report for: ${user.companyName}`);

        const { companyName, email, userName } = user;
        const averageData = await fetchLastAverageDataFromS3();
        const userAverageData = averageData.filter(entry => entry.userName === userName);

        if (!userAverageData.length) {
            console.warn(`No average data found for user: ${userName}`);
            return;
        }

        const waterTables = await Promise.all(userAverageData.map(async entry => {
            return Promise.all(entry.stackData.map(async stack => {
                const maxMinData = await fetchLastMinandMaxData(userName, stack.stackName);
                return generateWaterTable(stack.stackName, stack.parameters, maxMinData);
            }));
        }));

        const { energyTable, flowTable } = await fetchEnergyAndFlowData(userName);
        const combinedWaterTables = waterTables.flat().filter(Boolean).join('');
        const htmlContent = await generateCombinedPDFContent(companyName, combinedWaterTables, energyTable, flowTable);

        const dir = path.join(__dirname, 'PDFs');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);

        const filePath = path.join(dir, `${userName}.pdf`);
        await generatePDF(htmlContent, filePath);

        await sendEmail(email, filePath);
    } catch (error) {
        console.error('Error generating or sending report:', error);
    }
};




// Schedule cron job
cron.schedule("5 1 * * *", async () => {
    try {
        const users = await User.find();
        console.log("Fetched Users:", users);  // Debugging log

        if (!users || users.length === 0) {
            console.warn("No users found. Skipping report generation.");
            return;
        }

        users.forEach(user => {
            console.log(`Processing report for user: ${user?.userName}`);
            generateAndSendReport(user);
        });
    } catch (error) {
        console.error("Error fetching users:", error);
    }
}, { timezone: "Asia/Kolkata" });


module.exports = { generateAndSendReport };
