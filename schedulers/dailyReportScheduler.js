const cron = require('node-cron');
const nodemailer = require('nodemailer');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// --- Configuration Section ---
const reportRecipients = [
    { userName: "EGL1", email: "sruthipr027@gmail.com" },
    { userName: "EGL2", email: "sruthipr027@gmail.com" },
    { userName: "EGL3", email: "sruthipr027@gmail.com" },
    { userName: "EGL4", email: "sruthipr027@gmail.com" },
    { userName: "EGL5", email: "sruthipr027@gmail.com" },
    { userName: "HH014", email: "sruthipr027@gmail.com" },
    { userName: "EGLH", email: "sruthipr027@gmail.com" }
];

// Define which parameters to show in Water Quality section
const WATER_QUALITY_PARAMS = ['ph', 'TURB', 'Temp', 'BOD', 'COD', 'TSS'];

// Validate environment variables at startup
function validateEnvironment() {
    const required = ['API_URL', 'EMAIL', 'PASSWORD'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        console.error('❌ CRITICAL: Missing environment variables:', missing.join(', '));
        console.error('Please create a .env file with:');
        console.error('API_URL=http://localhost:5555');
        console.error('EMAIL=info.ebhoom@gmail.com');
        console.error('PASSWORD=iwei jhqo yten xthp');
        process.exit(1);
    }
    console.log('✅ Environment variables validated');
}

// Retry logic for API calls
async function fetchWithRetry(url, config, maxRetries = 2, retryDelay = 5000) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await axios.get(url, config);
        } catch (error) {
            lastError = error;
            if (attempt < maxRetries) {
                console.log(`   ⏳ Retry ${attempt}/${maxRetries - 1}, waiting ${retryDelay / 1000}s...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }
    }
    throw lastError;
}

async function fetchAllReportData(userName) {
    console.log(`\n[${userName}] 🔍 Starting data fetch...`);
    try {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        
        const formatDate = (date) => {
            const d = new Date(date);
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}-${month}-${year}`;
        };
        
        const reportDateDashed = formatDate(yesterday);
        const reportDateSlashed = reportDateDashed.replace(/-/g, '/');
        
        const API_URL = process.env.API_URL;
        
        console.log(`[${userName}] 📡 Fetching user details from: ${API_URL}`);
        
        // Fetch user details with retry and longer timeout
        const allUsersResponse = await fetchWithRetry(`${API_URL}/api/getallusers`, {
            timeout: 60000
        }, 2, 3000);
        
        const user = allUsersResponse.data.users.find(u => u.userName === userName);
        
        if (!user) {
            console.error(`[${userName}] ❌ USER NOT FOUND in all users list!`);
            return null;
        }
        console.log(`[${userName}] ✅ User found: ${user.companyName}`);
        
        const industryType = user.validUserOne?.industryType || user.industryType;
        const stackName = "STP";
        
        console.log(`[${userName}] 📡 Making parallel API calls...`);
        
        // Make all API calls with longer timeout and retry
        const promises = [
            fetchWithRetry(`${API_URL}/api/average/user/${userName}/stack/${stackName}/time-range/average`, { 
                params: { startDate: reportDateDashed, endDate: reportDateDashed },
                timeout: 90000  // Increased to 90 seconds
            }, 3, 5000),  // 3 attempts with 5 second delay
            fetchWithRetry(`${API_URL}/api/maxmin/${userName}/${stackName}`, { 
                params: { fromDate: reportDateSlashed, toDate: reportDateSlashed },
                timeout: 60000
            }, 2, 3000),
            industryType && !industryType.includes('/') 
                ? fetchWithRetry(`${API_URL}/api/get-calibration-values-industryType/${industryType}`, {
                    timeout: 60000
                }, 2, 3000)
                : Promise.resolve(null),
            fetchWithRetry(`${API_URL}/api/energyAndFlowData/${userName}/${reportDateDashed}/${reportDateDashed}`, {
                timeout: 60000
            }, 2, 3000),
            fetchWithRetry(`${API_URL}/api/get-stacknames-by-userName/${userName}`, {
                timeout: 60000
            }, 2, 3000)
        ];
        
        const results = await Promise.allSettled(promises);
        
        const getDataFromSettled = (result, index, apiName) => {
            if (result.status === 'fulfilled' && result.value) { 
                console.log(`[${userName}] ✅ ${apiName} successful`);
                return result.value.data; 
            }
            console.error(`[${userName}] ❌ ${apiName} FAILED: ${result.reason?.message || 'Unknown error'}`);
            return null;
        };
        
        const avgData = getDataFromSettled(results[0], 0, 'Average Data API');
        const minMaxApiResponse = getDataFromSettled(results[1], 1, 'MinMax API');
        const calibData = getDataFromSettled(results[2], 2, 'Calibration API') || null;
        const energyFlowSourceData = getDataFromSettled(results[3], 3, 'Energy/Flow API')?.data || [];
        const allUserStacks = getDataFromSettled(results[4], 4, 'Stack Names API')?.stackNames || [];
        
        console.log(`[${userName}] 📊 Processing quality data...`);
        
        // Extract quality data - improved handling with detailed logging
        let qualityData = {};
        console.log(`[${userName}] Raw avgData type:`, typeof avgData);
        console.log(`[${userName}] Raw avgData:`, JSON.stringify(avgData).substring(0, 500));
        
        if (avgData) {
            if (avgData.success && avgData.data) {
                qualityData = avgData.data;
            } else if (avgData.data && typeof avgData.data === 'object') {
                qualityData = avgData.data;
            } else if (typeof avgData === 'object' && !avgData.success) {
                // Try to use avgData directly if it has quality parameters
                qualityData = avgData;
            }
            
            console.log(`[${userName}] 📊 Quality parameters found:`, Object.keys(qualityData).length);
            console.log(`[${userName}] 📊 Available params:`, Object.keys(qualityData).slice(0, 10).join(', '));
            
            if (Object.keys(qualityData).length === 0) {
                console.warn(`[${userName}] ⚠️  Quality data is empty - avgData structure:`, Object.keys(avgData || {}).join(', '));
            }
        } else {
            console.error(`[${userName}] ❌ avgData is null or undefined`);
        }
        
        // Extract min/max data
        const minMaxData = minMaxApiResponse?.success 
            ? (minMaxApiResponse.data.find(item => item.stackName === stackName) || {}) 
            : {};
        
        console.log(`[${userName}] Min/Max data keys:`, Object.keys(minMaxData).length);
        
        // Extract calibration limits
        const calibrationExceed = calibData?.success 
            ? (calibData.IndustryTypCalibrationExceedValues[0] || {}) 
            : {};
        
        console.log(`[${userName}] 💧 Processing water quantity...`);
        
        // Process Water Quantity Data
        const quantityData = allUserStacks
            .filter(s => s.stationType === "effluent_flow")
            .map(stack => {
                const stackEntries = energyFlowSourceData.filter(e => 
                    e.stackName === stack.name && e.stationType === 'effluent_flow'
                );
                
                if (stackEntries.length === 0) {
                    return {
                        stackName: stack.name,
                        initialFlow: "0.00",
                        finalFlow: "0.00",
                        flowDifference: "0.00"
                    };
                }
                
                stackEntries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                
                const firstEntry = stackEntries[0];
                const lastEntry = stackEntries[stackEntries.length - 1];
                
                const initialFlow = Number(firstEntry.initialCumulatingFlow) || 0;
                const finalFlow = Number(lastEntry.lastCumulatingFlow) || 0;
                const flowDifference = Math.max(0, finalFlow - initialFlow);
                
                return {
                    stackName: stack.name,
                    initialFlow: initialFlow.toFixed(2),
                    finalFlow: finalFlow.toFixed(2),
                    flowDifference: flowDifference.toFixed(2)
                };
            });
        
        console.log(`[${userName}] ⚡ Processing energy data...`);
        
        // Process Energy Data
        const allEnergyEntries = energyFlowSourceData.filter(e => e.stationType === 'energy');
        const uniqueEnergyMeters = [...new Set(allEnergyEntries.map(e => e.stackName))];
        
        const energyData = uniqueEnergyMeters.map(stackName => {
            const entries = energyFlowSourceData
                .filter(e => e.stackName === stackName && e.stationType === 'energy')
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
            if (entries.length === 0) {
                return {
                    stackName,
                    initialEnergy: "0.00",
                    finalEnergy: "0.00",
                    energyDifference: "0.00"
                };
            }
            
            const startEntry = entries[0];
            const endEntry = entries[entries.length - 1];
            
            const initialEnergy = Number(startEntry.initialEnergy) || 0;
            const lastEnergy = Number(endEntry.lastEnergy) || 0;
            const energyDifference = Math.max(0, lastEnergy - initialEnergy);
            
            return {
                stackName,
                initialEnergy: initialEnergy.toFixed(2),
                finalEnergy: lastEnergy.toFixed(2),
                energyDifference: energyDifference.toFixed(2)
            };
        });
        
        console.log(`[${userName}] ✅ Data fetch COMPLETE!`);
        console.log(`[${userName}] Summary - Quality params: ${Object.keys(qualityData).length}, Quantity stacks: ${quantityData.length}, Energy meters: ${energyData.length}`);
        
        return {
            userName,
            stackName,
            companyName: user.companyName,
            address: user.address,
            reportDate: reportDateDashed,
            quality: qualityData,
            minMax: minMaxData,
            limits: calibrationExceed,
            quantity: quantityData,
            energy: energyData,
        };
    } catch (error) {
        console.error(`[${userName}] 💥 CRITICAL ERROR in fetchAllReportData:`, error.message);
        console.error(`[${userName}] Stack trace:`, error.stack);
        return null;
    }
}

function generateReportHtml(data) {
    const { quality, minMax, limits, quantity, energy, stackName, companyName, address, reportDate } = data;
    
    console.log(`[${data.userName}] Generating HTML - Quality keys available:`, Object.keys(quality || {}).length);
    
    // Generate Water Quality rows
    const qualityRows = WATER_QUALITY_PARAMS
        .filter(param => quality && quality.hasOwnProperty(param))
        .map(param => {
            const avgValue = parseFloat(quality[param]).toFixed(2);
            const minValue = minMax?.minValues?.[param] 
                ? parseFloat(minMax.minValues[param]).toFixed(2) 
                : 'N/A';
            const maxValue = minMax?.maxValues?.[param] 
                ? parseFloat(minMax.maxValues[param]).toFixed(2) 
                : 'N/A';
            const limit = limits?.[param] 
                ? parseFloat(limits[param]).toFixed(2) 
                : 'N/A';
            
            const isExceeded = limit !== 'N/A' && parseFloat(avgValue) > parseFloat(limit);
            
            console.log(`[${data.userName}] Quality row - ${param}: ${avgValue} (limit: ${limit})`);
            
            return `<tr>
                <td>${param}</td>
                <td style="${isExceeded ? 'color: red; font-weight: bold;' : ''}">${avgValue}</td>
                <td>${minValue}</td>
                <td>${maxValue}</td>
                <td>${limit}</td>
            </tr>`;
        }).join('');
    
    const qualityHtml = qualityRows || '<tr><td colspan="5">No quality data available.</td></tr>';
    
    console.log(`[${data.userName}] Generated ${qualityRows.length > 0 ? 'YES' : 'NO'} quality rows`);
    
    // Generate Water Quantity rows
    const quantityRows = quantity && quantity.length > 0
        ? quantity.map(q => `<tr>
            <td>${q.stackName}</td>
            <td>${q.initialFlow}</td>
            <td>${q.finalFlow}</td>
            <td>${q.flowDifference}</td>
        </tr>`).join('')
        : '<tr><td colspan="4">No quantity data available.</td></tr>';
    
    // Generate Energy rows
    const energyRows = energy && energy.length > 0
        ? energy.map(e => `<tr>
            <td>${e.stackName}</td>
            <td>${e.initialEnergy}</td>
            <td>${e.finalEnergy}</td>
            <td>${e.energyDifference}</td>
        </tr>`).join('')
        : '<tr><td colspan="4">No energy data available.</td></tr>';
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    margin: 20px; 
                    color: #333; 
                }
                .report-container { 
                    border: 1px solid #eee; 
                    padding: 25px; 
                    box-shadow: 0 0 10px rgba(0,0,0,0.05); 
                }
                .report-header, .report-info-header { 
                    text-align: center; 
                    margin-bottom: 20px; 
                }
                .report-header h1 { 
                    color: #236a80; 
                    margin: 0;
                }
                .report-info-header { 
                    font-size: 1.1em; 
                    font-weight: bold; 
                    margin-bottom: 30px; 
                    background-color: #236a80;
                    color: white;
                    padding: 15px;
                }
                .report-section-title { 
                    font-size: 1.3em; 
                    color: #236a80; 
                    margin-top: 30px; 
                    margin-bottom: 10px; 
                    border-bottom: 2px solid #236a80; 
                    padding-bottom: 5px; 
                }
                .report-table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin-top: 15px; 
                }
                .report-table th, .report-table td { 
                    border: 1px solid #ccc; 
                    text-align: center; 
                    padding: 10px; 
                    font-size: 0.9em;
                }
                .report-table th { 
                    background-color: #236a80; 
                    color: white;
                    font-weight: bold; 
                }
                .loading-indicator {
                    text-align: center;
                    padding: 20px;
                    color: #999;
                }
            </style>
        </head>
        <body>
            <div class="report-container">
                <div class="report-header">
                    <h1>Daily Environmental Report</h1>
                </div>
                <div class="report-info-header">
                    ${stackName} - ${companyName}, ${address}<br>
                    (${reportDate.split('-').reverse().join('/')} to ${reportDate.split('-').reverse().join('/')})
                </div>
                
                <div class="report-section-title">Water Quality</div>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Parameter</th>
                            <th>Avg Value</th>
                            <th>Min Value</th>
                            <th>Max Value</th>
                            <th>Acceptable Max Limit</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${qualityHtml}
                    </tbody>
                </table>
                
                <div class="report-section-title">Water Quantity</div>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Initial Reading</th>
                            <th>Final Meter Reading</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${quantityRows}
                    </tbody>
                </table>
                
                <div class="report-section-title">Energy Report</div>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Stack Name</th>
                            <th>Initial Reading</th>
                            <th>Last Reading</th>
                            <th>Total kWh</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${energyRows}
                    </tbody>
                </table>
            </div>
        </body>
        </html>
    `;
}

async function generatePdf(htmlContent, userName) {
    console.log(`[${userName}] 📄 Starting PDF generation...`);
    
    const dir = path.join(__dirname, 'reports');
    
    // Ensure directory exists
    if (!fs.existsSync(dir)) {
        console.log(`[${userName}] 📁 Creating reports directory at: ${dir}`);
        fs.mkdirSync(dir, { recursive: true });
    }
    
    const timestamp = Date.now();
    const fileName = `report_${userName}_${timestamp}.pdf`;
    const filePath = path.join(dir, fileName);
    
    console.log(`[${userName}] 📁 PDF will be saved to: ${filePath}`);
    
    let browser;
    
    try {
        console.log(`[${userName}] 🌐 Launching Puppeteer browser...`);
        
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu'
            ]
        });
        
        console.log(`[${userName}] ✅ Browser launched successfully`);
        
        const page = await browser.newPage();
        console.log(`[${userName}] 📝 Setting HTML content...`);
        
        // Increased timeout to ensure all data loads
        await page.setContent(htmlContent, { 
            waitUntil: 'networkidle0',
            timeout: 60000
        });
        
        // Wait additional time for rendering using Promise
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log(`[${userName}] 🖨️ Generating PDF...`);
        
        await page.pdf({
            path: filePath,
            format: 'A4',
            printBackground: true,
            margin: { 
                top: '0.5in', 
                right: '0.5in', 
                bottom: '0.5in', 
                left: '0.5in' 
            }
        });
        
        // Verify file exists
        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            console.log(`[${userName}] ✅ PDF generated successfully: ${fileName} (${stats.size} bytes)`);
            return filePath;
        } else {
            throw new Error('PDF file was not created');
        }
        
    } catch (error) {
        console.error(`[${userName}] 💥 PDF generation FAILED:`, error.message);
        console.error(`[${userName}] Stack trace:`, error.stack);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
            console.log(`[${userName}] 🔒 Browser closed`);
        }
    }
}

async function sendEmail(recipientEmails, pdfPath, companyName, userName) {
    console.log(`[${userName}] 📧 Preparing to send email...`);
    console.log(`[${userName}] Recipients: ${recipientEmails}`);
    console.log(`[${userName}] PDF Path: ${pdfPath}`);
    
    // Verify PDF exists before sending
    if (!fs.existsSync(pdfPath)) {
        throw new Error(`PDF file does not exist at: ${pdfPath}`);
    }
    
    const stats = fs.statSync(pdfPath);
    console.log(`[${userName}] PDF size: ${stats.size} bytes`);
    
    try {
        console.log(`[${userName}] 🔐 Creating email transporter...`);
        
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            debug: true,
            logger: true
        });
        
        // Verify transporter configuration
        console.log(`[${userName}] 🔍 Verifying email configuration...`);
        await transporter.verify();
        console.log(`[${userName}] ✅ Email configuration verified`);
        
        // Split emails by comma and trim
        const emailArray = recipientEmails.split(',').map(email => email.trim());
        
        const mailOptions = {
            from: `"${companyName} Daily Report" <${process.env.EMAIL_USER}>`,
            to: emailArray.join(','),
            subject: `Daily Environmental Report - ${companyName} (${userName})`,
            text: `Please find the daily environmental report for ${companyName} attached.`,
            html: `
                <p>Dear Team,</p>
                <p>Please find the daily environmental report for <strong>${companyName}</strong> attached to this email.</p>
                <p>Best regards,<br>Automated Reporting System</p>
            `,
            attachments: [{
                filename: path.basename(pdfPath),
                path: pdfPath,
                contentType: 'application/pdf'
            }],
        };
        
        console.log(`[${userName}] 📤 Sending email...`);
        const info = await transporter.sendMail(mailOptions);
        
        console.log(`[${userName}] ✅ Email SENT SUCCESSFULLY!`);
        console.log(`[${userName}] Message ID: ${info.messageId}`);
        console.log(`[${userName}] Recipients: ${emailArray.length}`);
        
    } catch (error) {
        console.error(`[${userName}] 💥 Email FAILED:`, error.message);
        console.error(`[${userName}] Error code:`, error.code);
        console.error(`[${userName}] Stack trace:`, error.stack);
        throw error;
    }
}

async function processReportForUser(userName, email) {
    console.log(`\n🚀 === STARTING REPORT FOR ${userName} ===`);
    let pdfPath = '';
    
    try {
        // STEP 1: Fetch Data
        console.log(`1️⃣ [${userName}] Fetching data...`);
        const reportData = await fetchAllReportData(userName);
        
        if (!reportData) {
            console.error(`❌ [${userName}] NO DATA - SKIPPING`);
            return false;
        }

        if (!reportData.companyName) {
            console.error(`❌ [${userName}] NO COMPANY NAME - SKIPPING`);
            return false;
        }

        console.log(`[${userName}] Company: ${reportData.companyName}`);
        console.log(`[${userName}] Quality data keys: ${Object.keys(reportData.quality || {}).length}`);

        // STEP 2: Generate HTML
        console.log(`2️⃣ [${userName}] Generating HTML...`);
        const htmlContent = generateReportHtml(reportData);
        console.log(`[${userName}] HTML length: ${htmlContent.length} characters`);

        // STEP 3: Generate PDF
        console.log(`3️⃣ [${userName}] Generating PDF...`);
        pdfPath = await generatePdf(htmlContent, userName);
        
        if (!pdfPath || !fs.existsSync(pdfPath)) {
            throw new Error('PDF was not created successfully');
        }

        // STEP 4: Send Email
        console.log(`4️⃣ [${userName}] Sending email...`);
        await sendEmail(email, pdfPath, reportData.companyName, userName);
        
        console.log(`✅ === ${userName} COMPLETED SUCCESSFULLY ===`);
        return true;
        
    } catch (error) {
        console.error(`💥 === ${userName} FAILED ===`);
        console.error(`Error: ${error.message}`);
        console.error(`Stack: ${error.stack}`);
        return false;
    } finally {
        // Optional: Clean up PDF after sending (uncomment to enable)
        /*
        if (pdfPath && fs.existsSync(pdfPath)) {
            try {
                fs.unlinkSync(pdfPath);
                console.log(`🗑️ [${userName}] PDF cleaned up`);
            } catch (err) {
                console.error(`[${userName}] Failed to delete PDF:`, err.message);
            }
        }
        */
    }
}

// Validate environment on startup
validateEnvironment();

// 🔥 CRON SCHEDULED FOR TESTING: Run at 7:00 PM IST
// After testing, change to '1 0 * * *' for daily at 12:01 AM IST
cron.schedule('39 13 * * *', async () => {
    console.log(`\n🎯==============================================`);
    console.log(`[${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}] REPORT JOB STARTED`);
    console.log(`🎯==============================================`);
    
    let successCount = 0;
    let failureCount = 0;
    const failedUsers = [];
    
    // Process users ONE BY ONE
    for (const recipient of reportRecipients) {
        const success = await processReportForUser(recipient.userName, recipient.email);
        if (success) {
            successCount++;
        } else {
            failureCount++;
            failedUsers.push(recipient.userName);
        }
        
        // Small delay between users
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log(`\n📊 JOB SUMMARY:`);
    console.log(`✅ SUCCESS: ${successCount}/${reportRecipients.length}`);
    console.log(`❌ FAILED: ${failureCount}/${reportRecipients.length}`);
    if (failedUsers.length > 0) {
        console.log(`Failed users: ${failedUsers.join(', ')}`);
    }
    console.log(`🎯==============================================`);
}, {
    scheduled: true,
    timezone: 'Asia/Kolkata',
});

console.log('\n✅ Daily Report Generator Started!');
console.log('🕐 Scheduled for 7:00 PM IST daily (Testing)');
console.log('👥 Users configured:', reportRecipients.map(r => r.userName).join(', '));
console.log('📁 PDFs will be saved in:', path.join(__dirname, 'reports'));
console.log('⚠️  After testing, change cron to "1 0 * * *" for 12:01 AM IST');
console.log('\n💡 Make sure your .env file contains:');
console.log('   - API_URL');
console.log('   - EMAIL_USER');
console.log('   - EMAIL_PASS (Gmail App Password)');
console.log('\n📧 Gmail App Password: https://myaccount.google.com/apppasswords\n');