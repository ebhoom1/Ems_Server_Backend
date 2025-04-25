const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const moment = require('moment');

const keysecret = process.env.SECRET_KEY;

// Sub‐schema for operators
const OperatorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    validate: [ validator.isEmail, 'Invalid operator email' ]
  },
  password: {
    type: String,
    required: true
  },
  userType: {
    type: String,
    enum: ['operator'],    // operators are always operator
    default: 'operator'
  }
});

// Main User schema
const userSchema = new mongoose.Schema({
  date: {
    type: String
  },
  userName: {
    type: String,
    required: true,
    unique: true
  },
  stackName: {
    type: [{
      name:       { type: String },
      stationType:{ type: String }
    }],
    default: []
  },
  modelName:          { type: String },
  companyName:        { type: String },
  fname: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    validate(value) {
      if (!validator.isEmail(value)) {
        throw new Error('Not a valid Email');
      }
    }
  },
  additionalEmails: {
    type: [String],
    default: [],
    validate: {
      validator(emails) {
        return emails.every(e => validator.isEmail(e));
      },
      message: 'One or more additional emails are invalid.'
    }
  },
  mobileNumber: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  cpassword: {
    type: String,
    required: true,
    minlength: 8
  },
  subscriptionDate:    { type: String },
  subscriptionPlan:    { type: String },
  endSubscriptionDate: { type: String },
  iotLastEnterDate:    { type: String },
  subscriptionActive: {
    type: Boolean,
    default: false
  },
  userType: {
    type: String,
    enum: ['admin','user','operator','technician'],
    required: true,
    default: 'user'
  },
  adminType: {
    type: String,
    required: true
  },
  industryType:           { type: String },
  industryPollutionCategory:{ type: String },
  dataInteval:            { type: String },
  district:               { type: String },
  state:                  { type: String },
  address:                { type: String },
  latitude: {
    type: Number,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  },
  productID: {
    type: Number,
    required: true
  },
  operators: {
    type: [OperatorSchema],
    default: []
  },
  tokens: [{
    token: {
      type: String,
      required: true
    }
  }],
  verifytoken: { type: String },
  timestamp: {
    type: Date,
    default: () => moment().toDate()
  }
});

// Hash main password + cpassword and any new operator passwords
userSchema.pre("save", async function (next) {
  if (this.isModified('password') && !this.password.startsWith('$2')) {
    const hash = await bcrypt.hash(this.password, 12);
    this.password  = hash;
    this.cpassword = hash;
  }
  if (this.isModified("operators")) {
    for (let op of this.operators) {
      if (!op.password.startsWith("$2")) {
        op.password = await bcrypt.hash(op.password, 12);
      }
    }
  }
  next();
});

// Compare candidate password to stored hash
userSchema.methods.comparePassword = function(candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Generate & store a JWT
userSchema.methods.generateAuthtoken = async function () {
  const token = jwt.sign(
    { _id: this._id, userType: this.userType, adminType: this.adminType },
    keysecret,
    { expiresIn: '30d' }
  );
  this.tokens.push({ token });
  await this.save();
  return token;
};

module.exports = mongoose.model('Users', userSchema);
