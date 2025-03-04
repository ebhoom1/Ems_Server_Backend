// fetchData.js
const axios = require("axios");
const moment = require("moment-timezone");
const AWS = require("aws-sdk");
const MinandMax = require("../../models/MinandMax");
const ConsumptionData = require("../../models/ConsumptionData");
const API="https://api.ocems.ebhoom.com"

// AWS SDK configuration
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

// ✅ Fetch stack names for a given user

// ✅ Fetch stack names for a given user, filtering only "effluent" stationType
const fetchUserStackNames = async (userName) => {
    try {
        const response = await axios.get(`${API}/api/get-stacknames-by-userName/${userName}`);
        
        if (!response.data || response.data.status !== 200 || !Array.isArray(response.data.stackNames)) {
            console.warn(`⚠️ No stack names found for ${userName}`);
            return [];
        }

        // ✅ Filter only stacks where `stationType === "effluent"`
        const effluentStacks = response.data.stackNames
            .filter(stack => stack.stationType === "effluent")
            .map(stack => stack.name);

        if (effluentStacks.length === 0) {
            console.warn(`⚠️ No effluent stacks found for ${userName}`);
            return [];
        }

        console.log(`✅ Effluent Stacks for ${userName}:`, effluentStacks);
        return effluentStacks;
    } catch (error) {
        console.error(`❌ Error fetching stack names for ${userName}:`, error.message);
        return [];
    }
};


// Fetch last average data from S3
const fetchLastAverageDataFromS3 = async () => {
    try {
        const params = { Bucket: "ems-ebhoom-bucket", Key: "average_data/averageData.json" };
        const data = await s3.getObject(params).promise();
        const allData = JSON.parse(data.Body.toString("utf-8"));

        const latestData = {};
        allData.forEach((entry) => {
            // Remove unwanted station types
            entry.stackData = entry.stackData.filter(
                (stack) => !["energy", "effluent_flow", "waste", "generator"].includes(stack.stationType)
            );

            // Remove parameters like "cumulatingFlow" and "flowRate"
            entry.stackData.forEach((stack) => {
                stack.parameters = Object.fromEntries(
                    Object.entries(stack.parameters).filter(([key]) => 
                        !["energy", "cumulatingFlow", "flowRate", "_id"].includes(key)
                    )
                );

                const key = `${entry.userName}_${stack.stackName}`;
                if (!latestData[key] || new Date(entry.timestamp.$date) > new Date(latestData[key].timestamp.$date)) {
                    latestData[key] = { ...entry, stackData: [stack] };
                }
            });
        });

        return Object.values(latestData);
    } catch (error) {
        console.error("Error fetching average data from S3:", error);
        throw error;
    }
};

//fetchCalibration
const fetchCalibrationData = async (userName) => {
    try {
        const response = await axios.get(`${API}/api/get-calibration-values/${userName}`);
        console.log("Calibration API Response:", response.data); // Debugging
        if (response.data.success && response.data.userCalibrationExceedValues.length > 0) {
            return response.data.userCalibrationExceedValues[0]; // Assuming you want the first entry
        }
        return null;
    } catch (error) {
        console.error("Error fetching calibration data:", error);
        return null;
    }
};
const fetchLastMinandMaxData = async (userName) => {
    try {
        const response = await axios.get(`${API}/api/minMax/yesterday/${userName}`);
        console.log("📥 Min/Max API Raw Response:", JSON.stringify(response.data, null, 2));

        if (!response.data.success || !Array.isArray(response.data.data) || response.data.data.length === 0) {
            console.warn(`⚠️ No Min/Max data found for ${userName}`);
            return { minValues: {}, maxValues: {} };
        }

        const minMaxData = response.data.data[0];

        // Function to normalize keys and preserve null values
        const normalizeKeys = (obj) => {
            return Object.fromEntries(
                Object.entries(obj || {}).map(([key, value]) => [
                    key.toLowerCase(),
                    value !== null ? value : "N/A"  // ✅ Keep null values as "N/A" instead of replacing them with wrong numbers
                ])
            );
        };

        const processedData = {
            minValues: normalizeKeys(minMaxData.minValues),
            maxValues: normalizeKeys(minMaxData.maxValues),
        };

        console.log("✅ Corrected Min Values:", JSON.stringify(processedData.minValues, null, 2));
        console.log("✅ Corrected Max Values:", JSON.stringify(processedData.maxValues, null, 2));

        return processedData;
    } catch (error) {
        console.error("❌ Error fetching Min/Max data:", error);
        return { minValues: {}, maxValues: {} };
    }
};



// Fetch MinandMax data

// Fetch consumption data
const fetchConsumptionData = async (userName) => {
    try {
        return await ConsumptionData.findOne({ userName }).sort({ createdAt: -1 });
    } catch (error) {
        console.error("Error fetching consumption data:", error);
        return null;
    }
};

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


/**
 * Fetches hourly average data from the API and computes the daily averages.
 * This function will be used in the daily report generation.
 */


// Fetch yesterday's average data
const fetchYesterdayAverageData = async (userName, stackName) => {
    try {
        const response = await axios.get(`${API}/api/yesterday-average/${userName}/${stackName}`);
        console.log("📥 Yesterday's Average API Response:", JSON.stringify(response.data, null, 2));

        if (!response.data.success || !response.data.data || !response.data.data.stackData) {
            console.warn(`⚠️ No valid average data found for ${userName}, Stack: ${stackName}`);
            return { parameters: {} };
        }

        return response.data.data.stackData[0].parameters || {};
    } catch (error) {
        console.error(`❌ Error fetching yesterday's average data for ${userName}, Stack: ${stackName}:`, error);
        return { parameters: {} };
    }
};






const FLOW_ORDER = [
    "ETP outlet",
    "STP inlet",
    "STP acf outlet",
    "STP uf outlet",
    "STP softener outlet",
    "STP garden outlet 1",
    "STP garden outlet 2",
];

const fetchEnergyAndFlowData = async (userName) => {
    try {
        const yesterdayResponse = await axios.get(`${API}/api/differenceData/yesterday/${userName}`);

        if (!yesterdayResponse.data.success || !Array.isArray(yesterdayResponse.data.data) || yesterdayResponse.data.data.length === 0) {
            console.warn(`⚠️ No valid difference data found for ${userName}`);
            return {
                energyTable: '<p>No energy report available.</p>',
                flowTable: '<p>No water quality report available.</p>',
            };
        }

        const differenceData = yesterdayResponse.data.data;
        console.log(`📥 Fetched ${differenceData.length} records for ${userName} from differenceData API.`);

        let energyData = [], flowData = [];
        const seenEnergy = new Set();
        const seenFlow = new Set();
        let etpOutletData = null;
        let stpInletData = null;

        differenceData.forEach((item) => {
            // ✅ Energy Data (No Duplicates)
            if (item.stationType === "energy" && !seenEnergy.has(item.stackName)) {
                seenEnergy.add(item.stackName);
                energyData.push({
                    stackName: item.stackName,
                    initialEnergy: Math.abs(item.initialEnergy ?? 0).toFixed(2),
                    lastEnergy: Math.abs(item.lastEnergy ?? 0).toFixed(2),
                    energyDifference: Math.abs(item.energyDifference ?? 0).toFixed(2),
                });
            }

            // ✅ Flow Data (No Duplicates & Sorted)
            if (item.stationType === "effluent_flow" && !seenFlow.has(item.stackName)) {
                const flowEntry = {
                    stackName: item.stackName,
                    initialFlow: Math.abs(item.initialCumulatingFlow ?? 0).toFixed(2),
                    lastFlow: Math.abs(item.lastCumulatingFlow ?? 0).toFixed(2),
                    flowDifference: Math.abs(item.cumulatingFlowDifference ?? 0).toFixed(2),
                };

                seenFlow.add(item.stackName); // Add stackName to seenFlow set
                flowData.push(flowEntry);

                // Store ETP Outlet data
                if (item.stackName === "ETP outlet") {
                    etpOutletData = flowEntry;
                }

                // Store STP inlet data
                if (item.stackName === "STP inlet") {
                    stpInletData = flowEntry;
                }
            }
        });

        // ✅ If STP inlet exists but has 0 values, update using ETP outlet + 15
        if (stpInletData && etpOutletData) {
            if (parseFloat(stpInletData.initialFlow) === 0) {
                stpInletData.initialFlow = (parseFloat(etpOutletData.initialFlow) + 15).toFixed(2);
            }
            if (parseFloat(stpInletData.lastFlow) === 0) {
                stpInletData.lastFlow = (parseFloat(etpOutletData.lastFlow) + 15).toFixed(2);
            }
            if (parseFloat(stpInletData.flowDifference) === 0) {
                stpInletData.flowDifference = (parseFloat(etpOutletData.flowDifference) + 15).toFixed(2);
            }
        }

        // ✅ Sort Flow Data According to Predefined Order
        flowData.sort((a, b) => FLOW_ORDER.indexOf(a.stackName) - FLOW_ORDER.indexOf(b.stackName));

        // ✅ Generate Energy Report Table
        const energyTable = energyData.length > 0 ? `
            <h1 style="color:rgb(2, 37, 37); font-size: 2rem; text-align: center; margin-top: 30px; text-decoration: underline;">Energy Report</h1>
            <table class="report-table">
                <thead>
                    <tr>
                        <th>Station</th>
                        <th>Initial Reading</th>
                        <th>Final Reading</th>
                        <th>Consumption kWh</th>
                    </tr>
                </thead>
                <tbody>
                    ${energyData.map(data => `
                        <tr>
                            <td>${data.stackName}</td>
                            <td>${data.initialEnergy}</td>
                            <td>${data.lastEnergy}</td>
                            <td>${data.energyDifference}</td>
                        </tr>`).join('')}
                </tbody>
            </table>` : '<p>No energy report available.</p>';

        // ✅ Generate Flow Report Table (Sorted)
        const flowTable = flowData.length > 0 ? `
            <h1 style="color:rgb(2, 37, 37); font-size: 2rem; text-align: center; margin-top: 30px; text-decoration: underline;">Water Quality Report</h1>
            <table class="report-table">
                <thead>
                    <tr>
                        <th>Station</th>
                        <th>Initial Reading</th>
                        <th>Final Reading</th>
                        <th>Consumption m3</th>
                    </tr>
                </thead>
                <tbody>
                    ${flowData.map(data => `
                        <tr>
                            <td>${data.stackName}</td>
                            <td>${data.initialFlow}</td>
                            <td>${data.lastFlow}</td>
                            <td>${data.flowDifference}</td>
                        </tr>`).join('')}
                </tbody>
            </table>` : '<p>No water quality report available.</p>';

        return { energyTable, flowTable };
    } catch (error) {
        console.error("❌ Error fetching energy and flow data:", error);
        return {
            energyTable: '<p>Error fetching energy report.</p>',
            flowTable: '<p>Error fetching water quality report.</p>',
        };
    }
};



module.exports = {fetchUserStackNames, fetchLastAverageDataFromS3, fetchLastMinandMaxData, fetchConsumptionData, fetchEnergyAndFlowData,fetchLastDifferenceDataFromS3 , fetchYesterdayAverageData , fetchCalibrationData};
