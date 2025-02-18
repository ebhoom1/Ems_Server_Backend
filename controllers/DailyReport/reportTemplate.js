const axios = require("axios");
const moment = require("moment");
const fetchCalibrationExceedData = async (industryType) => {
    try {
        const response = await axios.get(`https://api.ocems.ebhoom.com/api/get-calibration-values-industryType/${industryType}`);
        if (response.data.success) {
            return response.data.IndustryTypCalibrationExceedValues[0] || {}; // Assuming only one record per industry type
        } else {
            console.warn("⚠️ No calibration exceedance data found.");
            return {};
        }
    } catch (error) {
        console.error("❌ Error fetching calibration exceedance data:", error);
        return {};
    }
};

const generateWaterTable = (stackName, parameters, exceedanceData) => {
    if (Object.keys(parameters).length === 0) return ''; // Skip empty tables

    const rows = Object.entries(parameters)
        .map(([param, value]) => {
            const avgValue = value ? parseFloat(value).toFixed(2) : "0.00";
            const minValue = 0;
            const maxValue = 0;

            let exceedence = "Within Limit"; // Default message

            // Check exceedance limits from calibration data
            if (exceedanceData[param]) {
                const minLimit = parseFloat(exceedanceData[`${param}Below`] || 0);
                const maxLimit = parseFloat(exceedanceData[`${param}Above`] || 0);
                if (minLimit && avgValue < minLimit) exceedence = "Below Limit";
                if (maxLimit && avgValue > maxLimit) exceedence = "Above Limit";
            }

            return `
        <tr>
            <td>${param}</td>
            <td>${avgValue}</td>
            <td>${minValue}</td>
            <td>${maxValue}</td>
            <td>${exceedence}</td>
        </tr>`;
        })
        .join("");

    return `
        <h2 style="color:rgb(0, 7, 9); font-size: 1.5rem; text-align: center; margin-top: 30px; text-decoration: underline;">Quality Report</h2>
        <table class="report-table">
            <thead>
                <tr>
                    <th>Parameter</th>
                    <th>Avg Value</th>
                    <th>Min Value</th>
                    <th>Max Value</th>
                    <th>Exceedence</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;
};


const generateCombinedPDFContent = async (companyName, waterTables, energyTable, flowTable) => {
    // ✅ Get the previous day's date dynamically
    const reportDate = moment().subtract(1, "day").format("DD/MM/YYYY");

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .report-title {
                    text-align: center;
                    color: rgb(2, 37, 37);
                    font-size: 1.8rem;
                    font-weight: bold;
                }
                .report-header {
                    text-align: center;
                    font-size: 1.2rem;
                    margin-top: 10px;
                    color: rgb(2, 37, 37);
                }
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
            <h1 class="report-title">Report for ${companyName}</h1>
            <h3 class="report-header">Date:${reportDate}</h3>
            ${waterTables}
            ${energyTable}
            ${flowTable}
        </body>
        </html>`;
};

module.exports = { generateWaterTable, generateCombinedPDFContent , fetchCalibrationExceedData };
