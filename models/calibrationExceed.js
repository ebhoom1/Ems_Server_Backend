const mongoose = require('mongoose');
const moment = require('moment');

const calibrationExceedSchema = new mongoose.Schema({
    sl_No:{
        type:Number 
    },
    commentByUser:{
        type: String 
    },
    commentByAdmin: { type: String },
    parameter:{type:String},
    value:{type:String},
    message:{type:String},
    formattedDate:{type:String},
    formattedTime:{type:String},
    industryType: { type: String },
    companyName: { type: String },
    stackName:{type:String},
    userName:{type:String},
    userId:{type:String},
    timestamp: { type: Date, default: Date.now },
    lastSmsSent: { type: Date, default: null },
       
        
     
});



const CalibrationExceed = mongoose.model('CalibrationExceed', calibrationExceedSchema);

module.exports = CalibrationExceed;
