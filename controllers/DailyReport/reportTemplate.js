// reportTemplate.js

const generateWaterTable = (stackName, parameters, exceedance) => {
    const rows = Object.entries(parameters)
        .filter(([param]) => param !== "_id") // Filter out the '_id' parameter
        .map(([param, value]) => {
            const minValue = 0;
            const maxValue = 0;
            const minAcceptable = exceedance?.[`${param}Min`] || "Not Added";
            const maxAcceptable = exceedance?.[`${param}Max`] || "Not Added";
            const exceedanceValue = exceedance?.[param] || "Not Added";

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
        })
        .join("");

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

const generateCombinedPDFContent = async (companyName, waterTables, energyTable, flowTable) => {
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

module.exports = { generateWaterTable, generateCombinedPDFContent };
