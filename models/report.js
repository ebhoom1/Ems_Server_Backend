const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({

    industryType:{
        type:String,
    },
    companyName:{
        type:String,
    },
    fromDate:{
        type:String,
    },
    toDate:{
        type:String,
    },
    engineerName:{
        type:String,
    },
    userName:{
        type:String
    },
    stackName:{
        type:String
    },
    calibrationExceeds: [{ 
        parameter: String,
        value: Number,
        formattedDate: String,
        formattedTime: String,
        message: String
      }],
    reportApproved: { type: Boolean, required: true },
})
const Report = mongoose.model('Report',reportSchema);

module.exports =Report