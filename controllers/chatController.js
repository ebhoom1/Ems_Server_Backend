const Chat = require('../models/chatModel');

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

exports.getMessages = async (req, res) => {
    const { from, to } = req.query;

    try {
        const messages = await Chat.find({
            $or: [
                { from: from, to: to },
                { from: to, to: from }
            ]
        }).sort('timestamp');

        res.status(200).json(messages);
    } catch (error) {
        res.status(400).json({ message: "Error retrieving messages", error: error.message });
    }
};
