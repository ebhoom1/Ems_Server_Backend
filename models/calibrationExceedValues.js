const mongoose = require('mongoose');

const calibrationExceedValueSchema = new mongoose.Schema({
    product_id: {
        type: String,
    },
    phBelow: {
        type: String,
    },
    phAbove:{
        type:String,
    },
    TDS: {
        type: String,
    },
    turbidity: {
        type: String,
    },
    temperature: {
        type: String,
    },
    BOD: {
        type: String,
    },
    COD: {
        type: String,
    },
    TSS: {
        type: String,
    },
    ORP: {
        type: String,
    },
    nitrate: {
        type: String,
    },
    ammonicalNitrogen: {
        type: String,
    },
    DO: {
        type: String,
    },
    chloride: {
        type: String,
    },
    PM:{
        type:String,
    },   
    SO2:{
        type:String,
    },
    NO2:{
        type:String
    },
    Mercury:{
        type:String,
    },
    PM10: {
        type: String,
    },
    PM25: {
        type: String,
    },
    NOH: {
        type: String,
    },
    NH3: {
        type: String,
    },
    WindSpeed: {
        type: String,
    },
    WindDir: {
        type: String,
    },
    AirTemperature: {
        type: String,
    },
    Humidity: {
        type: String,
    },
    solarRadiation: {
        type: String,
    },
    DB: {
        type: String,
    },
    date: {
        type: String,
    },
   
    adminUserName:{
        type:String,
    },
    adminName:{
        type:String
    },
    industryType:{
        type:String,
    },
    userName: {
        type: String
    },
    stackName:{
        type:String,
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

const CalibrationExceedValues = mongoose.model('CalibrationExceedValues', calibrationExceedValueSchema);

module.exports = CalibrationExceedValues;
