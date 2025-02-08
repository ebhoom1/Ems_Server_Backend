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



// Fetch MinandMax data
const fetchLastMinandMaxData = async (userName, stackName) => {
    try {
        const minMaxData = await MinandMax.findOne({ userName, stackName }).sort({ timestamp: -1 });

        return minMaxData ? { minValues: minMaxData.minValues || {}, maxValues: minMaxData.maxValues || {} } : {};
    } catch (error) {
        console.error("Error fetching MinandMax data:", error);
        return {};
    }
};

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


const fetchEnergyAndFlowData = async (userName) => {
    try {
        // Fetch yesterday's difference data from API
        const yesterdayResponse = await axios.get(`${API}/api/differenceData/yesterday/${userName}`);

        if (!yesterdayResponse.data.success || !Array.isArray(yesterdayResponse.data.data) || yesterdayResponse.data.data.length === 0) {
            console.warn(`No valid difference data found for ${userName}`);
            return { 
                energyTable: '<p>No energy report available.</p>', 
                flowTable: '<p>No water quality report available.</p>' 
            };
        }

        const differenceData = yesterdayResponse.data.data;
        console.log(`Fetched ${differenceData.length} records for ${userName} from differenceData API.`);

        let energyTable = '<p>No energy report available.</p>';
        let flowTable = '<p>No water quality report available.</p>';

        // ✅ Extract energy data
        const energyData = differenceData
            .filter(item => item.stationType === "energy")
            .map(item => ({
                stackName: item.stackName,
                initialEnergy: item.initialEnergy ?? "nil",
                lastEnergy: item.lastEnergy ?? "nil",
                energyDifference: item.energyDifference ?? "nil",
            }));

        if (energyData.length > 0) {
            energyTable = `
                <h1 style="color:rgb(2, 37, 37); font-size: 2rem; text-align: center; margin-top: 30px; text-decoration: underline;">Energy Report</h1>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Station</th>
                            <th>Initial Reading</th>
                            <th>Final Reading</th>
                            <th>Difference</th>
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
                </table>`;
        }

        // ✅ Extract flow data
        const flowData = differenceData
            .filter(item => item.stationType === "effluent_flow")
            .map(item => ({
                stackName: item.stackName,
                initialFlow: item.initialCumulatingFlow ?? "nil",
                lastFlow: item.lastCumulatingFlow ?? "nil",
                flowDifference: item.cumulatingFlowDifference ?? "nil",
            }));

        if (flowData.length > 0) {
            flowTable = `
                <h1 style="color:rgb(2, 37, 37); font-size: 2rem; text-align: center; margin-top: 30px; text-decoration: underline;">Water Quality Report</h1>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Station</th>
                            <th>Initial Reading</th>
                            <th>Final Reading</th>
                            <th>Difference</th>
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
                </table>`;
        }

        return { energyTable, flowTable };
    } catch (error) {
        console.error("❌ Error fetching energy and flow data:", error);
        return { 
            energyTable: '<p>Error fetching energy report.</p>', 
            flowTable: '<p>Error fetching water quality report.</p>' 
        };
    }
};



module.exports = { fetchLastAverageDataFromS3, fetchLastMinandMaxData, fetchConsumptionData, fetchEnergyAndFlowData,fetchLastDifferenceDataFromS3 };
