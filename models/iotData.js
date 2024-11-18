const { required } = require('joi');
const mongoose = require('mongoose');

// Stack Schema to store sensor data
const StackSchema = new mongoose.Schema({
    stackName: { type: String, required: true }, // Ensure stackName is mandatory
    stationType:{type:String},
    ph: { type: String },
    TDS: { type: String },
    turbidity: { type: String },
    Temp: { type: String },
    BOD: { type: String },
    COD: { type: String },
    TSS: { type: String },
    ORP: { type: String },
    nitrate: { type: String },
    ammonicalNitrogen: { type: String },
    DO: { type: String },
    chloride: { type: String },
    Flow: { type: String },
    Totalizer_Flow: { type: String },
    CO: { type: String },
    NOX: { type: String },
    TOC:{type:String},
    Pressure: { type: String },
    Fluoride: { type: String },
    PM: { type: String },
    SO2: { type: String },
    NO2: { type: String },
    Mercury: { type: String },
    PM10: { type: String },
    PM25: { type: String },
    NOH: { type: String },
    NH3: { type: String },
    HCl:{ type: String},
    total_chlorine: {type: String},
    chlorine:{type: String},
    WindSpeed: { type: String },
    WindDir: { type: String },
    AirTemperature: { type: String },
    Humidity: { type: String },
    solarRadiation: { type: String },
    DB: { type: String },
    cumulatingFlow: { type: Number,  }, //default: 0
    flowRate: { type: Number,  }, //default: 0
      energy: { type: Number,  }, //default: 0
    voltage: { type: Number,  }, //default: 0
    current: { type: Number,  }, //default: 0
    power: { type: Number,  }, //default: 0
    weight:{type:Number},
});
    
// IoT Data Schema to store all incoming data
const IotDataSchema = new mongoose.Schema({
    product_id: { type: String, required: true }, // Ensure product_id is mandatory
    stackData: {
        type: [StackSchema], // Array of stack objects
        validate: {
            validator: (v) => Array.isArray(v) && v.length > 0,
            message: 'stackData must contain at least one stack.',
        },
    },
    date: { type: String, required: true },
    time: { type: String, required: true },
    topic: { type: String, default: 'N/A' },
    companyName: { type: String, required: true },
    industryType: { type: String, required: true },
    userName: { type: String, required: true },
    mobileNumber: { type: String, required: true },
    email: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    validationMessage: { type: String, default: 'Validated' },
    validationStatus: { type: String, default: 'Valid' },
    ExceedanceColor: { type: String, },
    timeIntervalColor: { type: String, },
    exceedanceComment: { type: String, },
    timeIntervalComment: { type: String, },
});

// Export the models
const IotData = mongoose.model('IotData', IotDataSchema);
module.exports = IotData;
