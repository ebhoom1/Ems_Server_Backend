const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  userName: {
    type: String,
    required: true,
  },
  modelName: {
    type: String,
    required: true,
  },
  amountPaid: {
    type: Number,
    required: true,
  },
  paymentDate: {
    type: String,
    required: true,
  },
  orderId: {
    type: String,
    required: true,
    unique: true,
  },
  paymentId: {
    type: String,
    required: true,
    unique: true,
  },
});

module.exports = mongoose.model('Payment', PaymentSchema);
