const express=require('express')
const mongoose=require('mongoose');


const DB=async()=>{
    try {
        mongoose.connect(process.env.DB_URL,{
            useNewUrlParser:true,
            useUnifiedTopology:true,
            serverSelectionTimeoutMS: 30000, // 30 seconds
            socketTimeoutMS: 45000, // 45 seconds
        })
        const db = mongoose.connection;
        db.on('error',console.error.bind(console,'MongoDB connection error'));
        db.once('open',()=>{
            console.log(`Connected to MongoDB`);
        })
    } catch (error) {
        console.log(`MongoDB Error From Catch: ${error}`);
    }
    
}



module.exports=DB;