const axios = require("axios");
const moment = require("moment");

const generateWaterTable = (stackName, parameters, calibrationData, minValues, maxValues) => {
    if (Object.keys(parameters).length === 0) return '';

    console.log("🔍 Parameters in generateWaterTable:", JSON.stringify(parameters, null, 2));
    console.log("🔍 Min Values in generateWaterTable:", JSON.stringify(minValues, null, 2));
    console.log("🔍 Max Values in generateWaterTable:", JSON.stringify(maxValues, null, 2));

    const rows = Object.entries(parameters)
    .filter(([param]) => param.toLowerCase() !== "_id") // Exclude `_id`
    .map(([param, value]) => {     
           const avgValue = value ? parseFloat(value).toFixed(2) : "0.00";
        const paramKey = param.toLowerCase(); // Ensure case consistency

        let exceedence = calibrationData?.[paramKey] ?? "-";
        let minValue = minValues?.[paramKey] ?? "-";
        let maxValue = maxValues?.[paramKey] ?? "-";

        console.log(`📝 ${param}: Avg=${avgValue}, Min=${minValue}, Max=${maxValue}, Exceedence=${exceedence}`);

        let avgColor = exceedence !== "-" && parseFloat(avgValue) > parseFloat(exceedence) ? 
            'style="color: red; font-weight: bold;"' : "";

        return `
            <tr>
                <td>${param}</td>
                <td ${avgColor}>${avgValue}</td>
                <td>${minValue}</td>
                <td>${maxValue}</td>
                <td>${exceedence}</td>
            </tr>`;
    }).join("");

    return `
        <h2 style="color:rgb(0, 7, 9); font-size: 1.5rem; text-align: center; margin-top: 30px; text-decoration: underline;">Quality Report</h2>
        <table class="report-table">
            <thead>
                <tr>
                    <th>Parameter</th>
                    <th>Avg Value</th>
                    <th>Min Limit</th>
                    <th>Max Limit</th>
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

module.exports = { generateWaterTable, generateCombinedPDFContent  };
