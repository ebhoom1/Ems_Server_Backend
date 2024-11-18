const express = require('express');
const router = express.Router();
const { sendMessage, getMessages } = require('../controllers/chatController');

// Route to send a message
router.post('/send', sendMessage);

// Route to get messages between two users
router.get('/messages', getMessages);

module.exports = router;
