const express = require('express');
const router = express.Router();
const logoController = require('../controllers/logoController');

router.post('/logo', logoController.uploadLogoImage, logoController.createLogo);
router.get('/logo/:adminType', logoController.getLogoByUserName);
router.put('/logo/:userName', logoController.uploadLogoImage, logoController.updateLogo);
router.delete('/logo/:userName', logoController.deleteLogoByUserName);

module.exports = router;
