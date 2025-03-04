const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
const puppeteer = require("puppeteer");
const { generateWaterTable, generateCombinedPDFContent } = require("./reportTemplate");
const { fetchYesterdayAverageData, fetchLastMinandMaxData, fetchEnergyAndFlowData ,fetchCalibrationData, fetchUserStackNames} = require("./fetchData");
const User = require("../../models/user");
const moment = require("moment-timezone");

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD,
    },
});

// Generate and send report

const generateAndSendReport = async (user) => {
    try {
        if (!user || !user.companyName || !user.email || !user.userName) {
            throw new Error("Invalid user object: Missing required fields");
        }

        const { companyName, email, userName } = user;
        const stackNames = await fetchUserStackNames(userName);
        if (stackNames.length === 0) {
            console.warn(`⚠️ No valid effluent stack names found for ${userName}`);
            return;  // Exit function if no valid stack is found
        }
        
        // ✅ Use the first effluent stack (modify if needed)
        const stackName = stackNames[0];
        console.log(`✅ Using stack: ${stackName} for ${userName}`);
                const yesterday = moment().tz("Asia/Kolkata").subtract(1, "day").format("DD/MM/YYYY"); // Ensure yesterday is available here

        // Fetch previous day's average data
        const averageData = await fetchYesterdayAverageData(userName, stackName);
        if (Object.keys(averageData).length === 0) {
            console.warn(`⚠️ No report available for ${userName}`);
            return;
        }

        // Fetch calibration data
        const calibrationData = await fetchCalibrationData(userName);

        // Fetch min/max data
        const { minValues, maxValues } = await fetchLastMinandMaxData(userName);

        // Generate water quality report (pass min/max values)
        const waterTable = generateWaterTable("Effluent_SeafoodLab_Monitoring", averageData, calibrationData, minValues, maxValues);

        // Fetch energy and flow data
        const { energyTable, flowTable } = await fetchEnergyAndFlowData(userName);

        // Generate final PDF report
        const htmlContent = await generateCombinedPDFContent(companyName, waterTable, energyTable, flowTable);
        const filePath = path.join(__dirname, "PDFs", `${userName}.pdf`);

        await generatePDF(htmlContent, filePath);
        await sendEmail(email, filePath);
    } catch (error) {
        console.error("❌ Error generating or sending report:", error);
    }
};



// Generate PDF
const generatePDF = async (htmlContent, filePath) => {
    try {
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: "domcontentloaded" });
        await page.pdf({ path: filePath, format: "A4", printBackground: true });
        await browser.close();
        console.log(`✅ PDF generated: ${filePath}`);
        return filePath;
    } catch (error) {
        console.error("❌ Error generating PDF:", error);
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
            text: "Please find attached the daily water quality report.",
            attachments: [{ filename: path.basename(pdfPath), path: pdfPath }],
        };
        await transporter.sendMail(mailOptions);
        console.log(`📧 Email sent to: ${email}`);
    } catch (error) {
        console.error(`❌ Error sending email to ${email}:`, error);
    }
};

module.exports = { generateAndSendReport };
