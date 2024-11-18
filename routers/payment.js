const express = require('express');
const { createOrder, verifyPayment,getTransactions,getTransactionsByUserName } = require('../controllers/payment');
const router = express.Router();

router.post('/create-order', createOrder);
router.post('/verify-payment', verifyPayment);
router.get('/transactions', getTransactions);   
router.get('/transaction-by-user/:userName',getTransactionsByUserName);

module.exports = router;