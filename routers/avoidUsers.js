const express = require('express');
const router = express.Router();
const avoidUsersController = require('../controllers/avoidUsersController');

// Add a user to the avoid list
router.post('/avoid-factor', avoidUsersController.addAvoidUser);

// Remove a user from the avoid list
router.delete('/remove/:userName', avoidUsersController.removeAvoidUser);

// Fetch all avoided users
router.get('/list', avoidUsersController.getAllAvoidUsers);

module.exports = router;
