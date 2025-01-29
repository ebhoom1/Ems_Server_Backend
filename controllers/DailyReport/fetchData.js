// fetchData.js

const AWS = require("aws-sdk");
const MinandMax = require("../../models/MinandMax");
const ConsumptionData = require("../../models/ConsumptionData");

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
            entry.stackData.forEach((stack) => {
                if (["energy", "effluent_flow", "waste", "generator"].includes(stack.stationType)) return;
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

module.exports = { fetchLastAverageDataFromS3, fetchLastMinandMaxData, fetchConsumptionData };
