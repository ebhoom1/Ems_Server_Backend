const mongoose=require('mongoose');
const validator=require('validator');
const bcrypt=require('bcryptjs');
const jwt=require('jsonwebtoken');
const moment =require('moment')

const keysecret=process.env.SECRET_KEY

const userSchema=new mongoose.Schema({
    date:{
        type:String,
    },
    userName:{
        type:String,
        required:true
        
    },
    stackName: {
        type: [
            {
                name: String,  // Stack name
                stationType: String  // Station type associated with the stack
            }
        ],  
        default: []
    },
    modelName:{
        type:String,
    
    },
    companyName:{
        type:String,
    },
    fname:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true,
        unique:true,
        validate(value){
            if(!validator.isEmail(value)){
                throw new Error ("not a valid Email")
            }
        }
    },
    mobileNumber:{
        type:String,
        required:true
    },
    password:{
        type:String,
        required:true,
        minlength:8
    },
    cpassword:{
        type:String,
        required:true,
        minlength:8
    },
    subscriptionDate:{
        type:String,
        
    },
    endSubscriptionDate:{
        type:String,
        
    },
    iotLastEnterDate:{
        type:String,
    },
    subscriptionActive: {
        type: Boolean,
        default: false,
      },
    userType:{
        type:String
    },
    industryType:{
        type:String,
    },
    industryPollutionCategory:{
        type:String,
    },
    dataInteval:{
        type:String
    },
    district:{
        type:String
    },
    state:{
        type:String,
    },
    address:{
        type:String,
    },
    latitude: {
        type: Number,
        required:true
      },
    longitude: {
        type: Number,
        required:true
    },
    productID:{
        type:Number,
        required:true
    },
    tokens:[
        {
            token:{
                type:String,
                required:true
            }
        }
    ],
    verifytoken:{
        type:String,
    },
    
    timestamp: {
        type: Date,  // Store as Date type
        default: () => moment().toDate()
    }
})

//hash password

userSchema.pre("save",async function(next){
    if(this.isModified("password")){
        this.password=await bcrypt.hash(this.password,12);
        this.cpassword=await bcrypt.hash(this.cpassword,12);
    }
    next()
})

//token generate

userSchema.methods.generateAuthtoken=async function(){
    try{
        let token23=jwt.sign({_id:this._id},keysecret,{
            expiresIn:"30d"
        });
        this.tokens=this.tokens.concat({token:token23})
        await this.save()
        return token23;
    }
    catch(error){
        throw error;
    }
}

//creating model
const userdb=new mongoose.model('Users',userSchema)

module.exports=userdb; 