// reportGenerator.js

const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
const nodemailer = require("nodemailer");
const puppeteer = require("puppeteer");
const { generateWaterTable, generateCombinedPDFContent } = require("./reportTemplate");
const { fetchLastAverageDataFromS3, fetchLastMinandMaxData, fetchConsumptionData } = require("./fetchData");
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
        const { companyName, email, userName } = user;
        const averageData = await fetchLastAverageDataFromS3();
        const userAverageData = averageData.filter((entry) => entry.userName === userName);
        if (!userAverageData.length) return;

        const waterTables = await Promise.all(userAverageData.map(async (entry) => {
            return Promise.all(entry.stackData.map(async (stack) => {
                const exceedance = {}; // Fetch exceedance if required
                return generateWaterTable(stack.stackName, stack.parameters, exceedance);
            }));
        }));

        const htmlContent = await generateCombinedPDFContent(companyName, waterTables.flat().join(""), "", "");
        const filePath = path.join(__dirname, "PDFs", `${userName}.pdf`);
        await generatePDF(htmlContent, filePath);
        await sendEmail(email, filePath);
    } catch (error) {
        console.error("Error generating or sending report:", error);
    }
};

// Schedule cron job
cron.schedule("*/2 * * * *", async () => {
    const users = await User.find();
    users.forEach(generateAndSendReport);
}, { timezone: "Asia/Kolkata" });

module.exports = { generateAndSendReport };
