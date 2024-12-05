const Chat = require('../models/chatModel');
const AWS = require('aws-sdk');
const moment = require('moment');


exports.sendMessage = async (req, res) => {
    const { from, to, message } = req.body;

    try {
        const chat = new Chat({
            from,
            to,
            message
        });

        await chat.save();
        res.status(201).send(chat);
    } catch (error) {
        res.status(400).json({ message: "Error sending message", error: error.message });
    }
};

// Configure AWS SDK
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

/**
 * Fetch chat data from S3 bucket.
 * @returns {Promise<Array>} - Parsed data from S3 file (JSON format).
 */
const fetchChatDataFromS3 = async () => {
    try {
        const key = 'chat_data/chatData.json'; // File path in the S3 bucket
        const params = {
            Bucket: 'ems-ebhoom-bucket', // Your S3 bucket name
            Key: key,
        };

        console.log(`Fetching chat data from S3 with key: ${key}`);
        const s3Object = await s3.getObject(params).promise();
        const fileContent = s3Object.Body.toString('utf-8');

        // Parse JSON content
        const jsonData = JSON.parse(fileContent);
        console.log('Fetched S3 Chat Data Length:', jsonData.length);

        return jsonData;
    } catch (error) {
        console.error('Error fetching chat data from S3:', error);
        throw new Error('Failed to fetch chat data from S3');
    }
};

/**
 * Retrieve messages between two users, first from MongoDB and fallback to S3.
 */


exports.getMessages = async (req, res) => {
    const { from, to } = req.query;

    try {
        // Step 1: Fetch data from MongoDB and S3 concurrently
        const [mongoMessages, s3Data] = await Promise.all([
            Chat.find({
                $or: [
                    { from, to },
                    { from: to, to: from },
                ],
            }).sort('timestamp'),
            fetchChatDataFromS3(),
        ]);

        // Step 2: Filter S3 data for the specific "from" and "to" criteria
        const filteredS3Data = s3Data.filter(
            (chat) =>
                (chat.from === from && chat.to === to) || (chat.from === to && chat.to === from)
        );

        // Step 3: Combine messages from MongoDB and S3
        const combinedMessages = [...mongoMessages, ...filteredS3Data];

        // Step 4: Sort the combined messages by timestamp
        const sortedMessages = combinedMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        if (sortedMessages.length > 0) {
            return res.status(200).json(sortedMessages);
        }

        res.status(404).json({ message: 'No chat messages found for the specified criteria.' });
    } catch (error) {
        console.error('Error retrieving chat messages:', error);
        res.status(500).json({ message: 'Error retrieving chat messages', error: error.message });
    }
};


