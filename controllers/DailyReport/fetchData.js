// fetchData.js
const axios = require("axios");
const moment = require("moment-timezone");
const AWS = require("aws-sdk");
const MinandMax = require("../../models/MinandMax");
const ConsumptionData = require("../../models/ConsumptionData");
const API="https://api/ocems.ebhoom.com"
// AWS SDK configuration
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

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
        
        console.log("📥 Min/Max API Response:", response.data);

        if (!response.data.success || !Array.isArray(response.data.data) || response.data.data.length === 0) {
            console.warn(`⚠️ No Min/Max data found for ${userName}`);
            return { minValues: {}, maxValues: {} };
        }

        // Assuming we take the first record (Modify this if there are multiple stacks)
        const minMaxData = response.data.data[0];

        return {
            minValues: minMaxData.minValues || {},
            maxValues: minMaxData.maxValues || {},
        };
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


const fetchAverageDataFromAPI = async (userName) => {
    try {
        const yesterday = moment().tz("Asia/Kolkata").subtract(1, "day").format("DD/MM/YYYY"); 
        console.log(`📥 Fetching hourly data for ${userName} on date: ${yesterday}`);

        const url = `${API}/api/average/user/${userName}/date/${yesterday}`;
        const response = await axios.get(url);

        if (!response.data.success || !Array.isArray(response.data.data) || response.data.data.length === 0) {
            console.warn(`⚠️ No valid data found for ${userName} on ${yesterday}`);
            return { message: "No Report Available", date: yesterday };
        }

        const records = response.data.data;
        const parameterSums = {};
        const parameterCounts = {};

        records.forEach((entry) => {
            entry.stackData.forEach((stack) => {
                Object.entries(stack.parameters).forEach(([param, value]) => {
                    if (param === "_id") return; // ✅ Skip "_id" in the table
                    if (!parameterSums[param]) {
                        parameterSums[param] = 0;
                        parameterCounts[param] = 0;
                    }
                    parameterSums[param] += value;
                    parameterCounts[param] += 1;
                });
            });
        });

        const averageData = {};
        Object.keys(parameterSums).forEach((param) => {
            averageData[param] = (parameterSums[param] / parameterCounts[param]).toFixed(2);
        });

        console.log(`📊 Computed average data for ${userName} on ${yesterday}:`, averageData);
        return { averageData, date: yesterday };
    } catch (error) {
        console.error(`❌ Error fetching average data from API for ${userName} on ${yesterday}:`, error);
        return { message: "No Report Available", date: yesterday };
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
            if (item.stationType === "effluent_flow") {
                const flowEntry = {
                    stackName: item.stackName,
                    initialFlow: Math.abs(item.initialCumulatingFlow ?? 0).toFixed(2),
                    lastFlow: Math.abs(item.lastCumulatingFlow ?? 0).toFixed(2),
                    flowDifference: Math.abs(item.cumulatingFlowDifference ?? 0).toFixed(2),
                };

                seenFlow.add(item.stackName);
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




module.exports = { fetchLastAverageDataFromS3, fetchLastMinandMaxData, fetchConsumptionData, fetchEnergyAndFlowData,fetchLastDifferenceDataFromS3 , fetchAverageDataFromAPI , fetchCalibrationData};
