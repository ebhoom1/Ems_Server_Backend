const express = require('express');
const router = express.Router();
const { sendMessage, getMessages } = require('../controllers/chatController');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });

// Route to send a message
router.post('/send', upload.array('files', 10), sendMessage);

// Route to get messages between two users
router.get('/messages', getMessages);

module.exports = router;
