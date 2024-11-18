const express = require('express');
const userdb = require('../models/user');
const Payment = require('../models/payment'); 
const razorpayInstance = require('../config/razorpayInstance');
const crypto = require('crypto');

// Create order
const createOrder = async (req, res) => {
  const { userName, amount } = req.body;
  
  const options = {
    amount: amount * 100, // Amount in paisa
    currency: "INR",
    receipt: `receipt_${userName}_${Date.now()}`,
  };
  try {
    const order = await razorpayInstance.orders.create(options);
    res.status(201).json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating order', error });
  }
};

// Verify payment and update subscription
const verifyPayment = async (req, res) => {
  const { order_id, payment_id, razorpay_signature, userName, modelName, amount } = req.body;

  const shasum = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
  shasum.update(`${order_id}|${payment_id}`);
  const digest = shasum.digest('hex');

  if (digest === razorpay_signature) {
    try {
      // Fetch user and update subscription end date
      const user = await userdb.findOne({ userName });
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Calculate new subscription end date
      const currentEndDate = new Date(user.endSubscriptionDate);
      currentEndDate.setMonth(currentEndDate.getMonth() + 1); // Adding one month

      // Update user's subscription
      user.endSubscriptionDate = currentEndDate.toISOString().split('T')[0];
      await user.save();

       // Save transaction details
       const paymentDate = new Date().toLocaleDateString('en-GB'); // Format: dd/mm/yyyy
       const newPayment = new Payment({
         userName,
         modelName,
         amountPaid: amount / 100,
         paymentDate,
         orderId: order_id,
         paymentId: payment_id,
       });
 
       await newPayment.save();

      res.status(200).json({ success: true, message: 'Payment verified and subscription updated' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error updating subscription', error });
      console.log('verify payment in catch:',error)
    }
  } else {
    res.status(400).json({ success: false, message: 'Invalid signature' });
  }
};
const getTransactions = async (req, res) => {
  try {
    const transactions = await Payment.find({});
    res.status(200).json({ success: true, transactions });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching transactions', error });
  }
};
const getTransactionsByUserName = async (req,res)=>{
  try{
     const {userName}=req.params;
     
     const transaction = await Payment.findOne({userName});

     if(!transaction){
      res.status(404).json({message:`Not found the user: ${userName}`})
     }
     res.status(200).json({
      status:200,
      success:true,
      message:`Fetched the Transaction details`,
      transaction
     })
  }catch(error){
    res.status(500).json({
      status:500,
      success:false,
      message:`Error in Fetching the Transaction details of  ${userName}`,
      error:message.error
    })
  }
}
module.exports = { createOrder, verifyPayment,getTransactions,getTransactionsByUserName  };