const generatePDF = (userData, averageData, minMaxData, calibrationData, stackName) => {
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Water Quality Report</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
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
        </style>
    </head>
    <body>
        <h1>Water Quality Report for ${userData.companyName}</h1>
        <table class="report-table">
            <thead>
                <tr>
                    <th>Parameter</th>
                    <th>Avg Value</th>
                    <th>Min Value</th>
                    <th>Max Value</th>
                    <th>Stack Name</th>
                    <th>Acceptable Min</th>
                    <th>Acceptable Max</th>
                </tr>
            </thead>
            <tbody>
                ${Object.keys(averageData).map((param) => `
                    <tr>
                        <td>${param}</td>
                        <td>${averageData[param] || 'N/A'}</td>
                        <td>${minMaxData.minValues?.[param] || 'N/A'}</td>
                        <td>${minMaxData.maxValues?.[param] || 'N/A'}</td>
                        <td>${stackName}</td>
                        <td>${calibrationData?.[param]?.acceptableMin || 'N/A'}</td>
                        <td>${calibrationData?.[param]?.acceptableMax || 'N/A'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </body>
    </html>
    `;
  
    return new Promise((resolve, reject) => {
        pdf.create(htmlContent).toBuffer((err, buffer) => {
            if (err) return reject(err);
            resolve(buffer);
        });
    });
  };
  