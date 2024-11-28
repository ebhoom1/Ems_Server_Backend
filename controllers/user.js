const express=require('express');
const userdb=require('../models/user');
const bcrypt=require('bcryptjs');
const nodemailer=require('nodemailer');
const jwt=require('jsonwebtoken');
const authenticate = require('../middleware/authenticate');




const keysecret=process.env.SECRET_KEY


//email config
const transporter=nodemailer.createTransport({
    host:'smtp.gmail.com',
    port:465,
    secure:true,
    service:'gmail',
    auth:{
        user:process.env.EMAIl,
        pass:process.env.PASSWORD
    }
})




const register = async (req, res) => {
    const { userName, companyName, modelName, fname, email, mobileNumber, password, cpassword, subscriptionDate, userType, adminType, industryType, industryPollutionCategory, dataInterval, district, state, address, latitude, longitude, productID } = req.body;

    // Validate passwords
    if (password !== cpassword) {
        return res.status(422).json({ error: "Passwords do not match" });
    }

    try {
        // Check if the email is already registered
        const existingUser = await userdb.findOne({ email }).lean().exec();
        if (existingUser) {
            return res.status(422).json({ error: "This Email Already Registered" });
        }

        // Calculate the subscription end date
        const subscriptionDateObj = new Date(subscriptionDate);
        const endSubscriptionDate = new Date(subscriptionDateObj);
        endSubscriptionDate.setDate(subscriptionDateObj.getDate() + 30);

        const formattedEndSubscriptionDate = endSubscriptionDate.toISOString().split('T')[0];

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create a new user
        const finalUser = new userdb({
            userName,
            companyName,
            modelName,
            fname,
            email,
            mobileNumber,
            password: hashedPassword,
            cpassword: hashedPassword, // Store the hashed version of cpassword as well
            subscriptionDate,
            endSubscriptionDate: formattedEndSubscriptionDate,
            userType,
            adminType,
            industryType,
            industryPollutionCategory,
            dataInterval,
            district,
            state,
            address,
            latitude,
            longitude,
            productID,
            iotLastEnterDate: subscriptionDate,
        });

        // Save the user in the database
        const storeData = await finalUser.save();
        return res.status(201).json({ status: 201, storeData });
    } catch (error) {
        console.error(`Error in registration: ${error.message}`);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};



// Add or Update Stack Names for a user
const updateStackName = async (req, res) => {
    const { companyName } = req.params;
    const { stackData } = req.body;

    if (!Array.isArray(stackData)) {
        return res.status(400).json({ message: "Stack data must be an array" });
    }

    try {
        const updatedUser = await userdb
            .findOneAndUpdate(
                { companyName },
                { stackName: stackData },
                { new: true, lean: true }
            )
            .exec();

        if (!updatedUser) {
            return res.status(404).json({ message: "User not found" });
        }
        return res.status(200).json({ message: "Stack names updated", updatedUser });
    } catch (error) {
        console.error(`Error updating stack names: ${error.message}`);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

const updateAdminType = async (req, res) => {
    const { userName, adminType } = req.body;

    if (!userName || !adminType) {
        return res.status(400).json({ error: "Please provide both userName and adminType" });
    }

    try {
        // Find the user by userName
        const user = await userdb.findOne({ userName }).exec();

        // If user not found, return an error
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Check if adminType is already set
        if (user.adminType) {
            return res.status(409).json({ error: "AdminType is already set for this user" });
        }

        // Update the adminType
        user.adminType = adminType;

        // Save the updated user
        await user.save();

        return res.status(200).json({ status: 200, message: "AdminType updated successfully", user });
    } catch (error) {
        console.error(`Error in updating adminType: ${error.message}`);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};


// user login
  
// const login = async (req, res) => {
//     const { email, password, userType } = req.body;

//     if (!email || !password || !userType) {
//         return res.status(422).json({ error: "Fill all the details" });
//     }

//     try {
//         const userValid = await userdb.findOne({ email });

//         if (userValid) {
//                 if(userValid.userType !== userType){
//                     return res.status(401).json({error:"Invalid UserType"})
//                 }

//             const isMatch = await bcrypt.compare(password, userValid.password);
//             if (!isMatch) {
//                 return res.status(422).json({ error: "Invalid User" });
//             } else {
//                 const token = await userValid.generateAuthtoken();
//                 res.cookie("usercookie", token, {
//                     expires: new Date(Date.now() + 9000000),
//                     httpOnly: true
//                 });
//                 const result = {
//                     userValid,
//                     token
//                 };
//                 return res.status(200).json({ status: 200, result }); // Send success response
//             }
//         } else {
//             return res.status(401).json({ status: 401, message: "Invalid details" }); // Send invalid details response
//         }
//     } catch (error) {
//         return res.status(500).json({ error: "Internal Server Error" + error});
//         console.log(`Error: ${error}`); // Send internal server error response
//     }
// };
const login = async (req, res) => {
    const { email, password, userType } = req.body;

    if (!email || !password || !userType) {
        return res.status(422).json({ error: "All fields are required" });
    }

    try {
        // Fetch user and validate userType without loading entire document
        const user = await userdb.findOne({ email });

        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        if (user.userType !== userType) {
            return res.status(401).json({ error: "User type mismatch" });
        }

        // Validate password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        // Generate a new token
        const token = jwt.sign({ _id: user._id }, process.env.SECRET_KEY, { expiresIn: "30d" });

        // Update the token in the database, overwriting previous tokens
        await userdb.updateOne(
            { _id: user._id },
            { $set: { tokens: [{ token }] } } // Overwrite the tokens array with the new token
        );

        // Set the token in cookies
        res.cookie("usercookie", token, {
            expires: new Date(Date.now() + 9000000),
            httpOnly: true,
        });

        // Return user details and token
        return res.status(200).json({ status: 200, user, token });
    } catch (error) {
        console.error(`Error during login: ${error.message}`);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};






 // user Valid 
 
 const validuser = async(req,res)=>{
        try {
            const validUserOne= await userdb.findOne({_id: req.userId})
            return res.status(201).json({status:201, validUserOne})
        } catch (error) {
            return res.status(401).json({status:401, error})
        }
 }

//user logout
const logout = async(req,res)=>{
    try {
        req.rootUser.tokens=req.rootUser.tokens.filter((curelem)=>{
            return curelem.token !== req.token
        })
        await req.rootUser.save()

            res.clearCookie("usercookie", {path:"/"});

            return res.status(201).json({status: 201})
        
    } catch (error) {
        return res.status(401).json({status : 401, error})
        console.log(error);
    }
}

// send email Link for reset Password

const sendPasswordLink= async (req,res)=>{
    console.log(req.body);

    const {email}=req.body

    if(!email){
        res.status(401).json({status: 401, message: "Enter your Email"})
    }
    try {
        const userfind=await userdb.findOne({email: email});

        //token generate for reset password
        const token = jwt.sign({_id: userfind._id}, keysecret,{
            expiresIn:"1d"
        })

        const setusertoken=await userdb.findByIdAndUpdate({_id: userfind._id},{verifytoken: token},{new: true});

        if(setusertoken){
            const mailOptions ={
                from:process.env.EMAIl,
                to:email,
                subject:"Sending Email for Password Reset",
                text:`This Link Valid for 2 Minutes http://ocems.ebhoom.com:5555/reset-password/${userfind._id}/${setusertoken.verifytoken}`

            }
            transporter.sendMail(mailOptions,(error,info)=>{
                if(error){
                    console.log("error",error);
                    res.status(401).json({status:401, message:"Email not send"})
                }else{
                    console.log("Email send", info.response);
                    res.status(201).json({status:201, message:"Email sent Successfully"})
                }
            })
        }
    } catch (error) {
        res.status(401).json({status:401,message:"Invalid User"})
    }
};
// verify user for forgot password time
const forgotPassword=async (req,res)=>{
    const {id, token} = req.params;

    try {
        const validuser = await userdb.findOne ({_id: id, verifytoken:token})

        const verifytoken = jwt.verify(token, keysecret);
        console.log(verifytoken);

        if(validuser && verifytoken._id){
            res.status(201).json({status:201, validuser})
        }else {
            res.status(401).json({status:401, message:"User not exist"})
        }
    } catch (error) {
        res.status(401).json({status:401, error})
    }
}

//change password

const changePassword = async (req, res) => {
    const { id, token } = req.params;
    const { password, cpassword } = req.body;

    if (password !== cpassword) {
        return res.status(422).json({ status: 422, message: "New password and confirmation password do not match" });
    }

    try {
        // Check if the token exists in the tokens array
        const user = await userdb.findOne({
            _id: id,
            "tokens.token": token, // Search for token in tokens array
        });

        if (!user) {
            return res.status(401).json({ status: 401, message: "User not found or invalid token" });
        }

        // Verify the token
        jwt.verify(token, process.env.SECRET_KEY);

        // Hash the new password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Update the password
        await userdb.updateOne({ _id: id }, { $set: { password: hashedPassword } });

        return res.status(200).json({ status: 200, message: "Password changed successfully" });
    } catch (error) {
        console.error(`Error changing password: ${error.message}`);
        return res.status(500).json({ status: 500, error: "Internal Server Error" });
    }
};
   
const getAllUsers = async (req, res) => {
    try {
        const users = await userdb.find({}, { password: 0, cpassword: 0 }).lean().exec(); // Exclude sensitive fields
        if (users.length === 0) {
            return res.status(404).json({ status: 404, message: "No users found" });
        }
        return res.status(200).json({ status: 200, users });
    } catch (error) {
        console.error(`Error fetching users: ${error.message}`);
        return res.status(500).json({ status: 500, error: "Internal Server Error" });
    }
};



// edit user
const editUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const updateFields = req.body;

        // Use findByIdAndUpdate with lean for faster updates
        const updatedUser = await userdb
            .findByIdAndUpdate(userId, updateFields, { new: true, lean: true })
            .exec();

        if (!updatedUser) {
            return res.status(404).json({ status: 404, message: "User Not Found" });
        }

        return res.status(200).json({
            status: 200,
            success: true,
            message: "User updated successfully",
            user: updatedUser,
        });
    } catch (error) {
        console.error(`Error updating user: ${error.message}`);
        return res.status(500).json({ status: 500, error: "Internal Server Error" });
    }
};

// Delete User
const deleteUser = async (req, res) => {
    try {
        const { userName } = req.params;

        // Use findOneAndDelete directly
        const deletedUser = await userdb.findOneAndDelete({ userName }).lean();

        if (!deletedUser) {
            return res.status(404).json({ status: 404, message: "User Not Found" });
        }

        return res.status(200).json({ status: 200, message: "User Deleted Successfully" });
    } catch (error) {
        console.error(`Error deleting user: ${error.message}`);
        return res.status(500).json({ status: 500, error: "Internal Server Error" });
    }
};


// Get A User
const getAUser = async (req, res) => {
    try {
        const { userId } = req.params;

        // Use findById with lean to optimize
        const user = await userdb.findById(userId, { password: 0 }).lean();

        if (!user) {
            return res.status(404).json({ status: 404, message: "User Not Found" });
        }

        return res.status(200).json({ status: 200, user });
    } catch (error) {
        console.error(`Error fetching user: ${error.message}`);
        return res.status(500).json({ status: 500, error: "Internal Server Error" });
    }
};

const getAUserByUserName = async (req, res) => {
    try {
        const { userName } = req.params;

        // Use findOne with lean
        const user = await userdb.findOne({ userName }, { password: 0 }).lean();

        if (!user) {
            return res.status(404).json({ status: 404, message: "User Not Found" });
        }

        return res.status(200).json({ status: 200, user });
    } catch (error) {
        console.error(`Error fetching user by username: ${error.message}`);
        return res.status(500).json({ status: 500, error: "Internal Server Error" });
    }
};

const getAUserByCompanyName = async (req, res) => {
    try {
        const { companyName } = req.params;

        const user = await userdb.findOne({ companyName }, { password: 0 }).lean();

        if (!user) {
            return res.status(404).json({ status: 404, message: "User Not Found" });
        }

        return res.status(200).json({ status: 200, user });
    } catch (error) {
        console.error(`Error fetching user by company name: ${error.message}`);
        return res.status(500).json({ status: 500, error: "Internal Server Error" });
    }
};

const getStackNamesByCompanyName = async (req, res) => {
    try {
        const { companyName } = req.params;

        // Fetch only stackName field
        const user = await userdb.findOne({ companyName }, { stackName: 1 }).lean();

        if (!user || !user.stackName?.length) {
            return res.status(404).json({ status: 404, message: "No stack names found" });
        }

        return res.status(200).json({ status: 200, stackNames: user.stackName });
    } catch (error) {
        console.error(`Error fetching stack names: ${error.message}`);
        return res.status(500).json({ status: 500, error: "Internal Server Error" });
    }
};

const getStackNamesByUserName = async (req, res) => {
    try {
        const { userName } = req.params;

        const user = await userdb.findOne({ userName }, { stackName: 1 }).lean();

        if (!user || !user.stackName?.length) {
            return res.status(404).json({ status: 404, message: "No stack names found" });
        }

        return res.status(200).json({ status: 200, stackNames: user.stackName });
    } catch (error) {
        console.error(`Error fetching stack names by username: ${error.message}`);
        return res.status(500).json({ status: 500, error: "Internal Server Error" });
    }
};

const findUsersByAdminType = async (req, res) => {
    const { adminType } = req.params;

    if (!adminType) {
        return res.status(400).json({ error: "Please provide an adminType" });
    }

    try {
        // Find users with the specified adminType, excluding those with userType === 'admin'
        const users = await userdb.find(
            {
                adminType,
                userType: 'user' // Only include users with userType === 'user'
            },
            {
                password: 0, // Exclude sensitive fields
                tokens: 0,    // Exclude tokens for security
            }
        ).lean();

        if (!users || users.length === 0) {
            return res.status(404).json({ message: "No users found matching the criteria" });
        }

        return res.status(200).json({ status: 200, users });
    } catch (error) {
        console.error(`Error fetching users by adminType: ${error.message}`);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};



//Change Current Password 
const changeCurrentPassword = async (req, res) => {
    const { userId, token } = req.params;
    const { password, newPassword, reEnterPassword } = req.body;

    if (newPassword !== reEnterPassword) {
        return res.status(422).json({ status: 422, message: "Passwords do not match" });
    }

    try {
        // Check if the token exists in the tokens array and fetch the user
        const user = await userdb.findOne({
            _id: userId,
            "tokens.token": token, // Search for token in tokens array
        });

        if (!user) {
            return res.status(401).json({ status: 401, message: "User not found or invalid token" });
        }

        // Validate the current password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ status: 401, message: "Current password is incorrect" });
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update the password
        await userdb.updateOne({ _id: userId }, { $set: { password: hashedPassword } });

        return res.status(200).json({ status: 200, message: "Password changed successfully" });
    } catch (error) {
        console.error(`Error changing password: ${error.message}`);
        return res.status(500).json({ status: 500, error: "Internal Server Error" });
    }
};



const getDeviceCredentidals = async(userId)=>{
    try {
        const user = await userdb.findById(userId)
        if(!user || !user.deviceCredentials){
            throw new Error('Device credentials not found for this user');
        }
        return user.deviceCredentials;
    } catch (error) {
        console.error(`Error fetching device credentials:`,error);
        throw error;
    }
}
const getAllDeviceCredentials = async (req, res) => {
    try {
        const credentials = await userdb.find({}, { userName: 1, email: 1, mobileNumber: 1, companyName: 1, industryType: 1, productID: 1 }).lean();

        if (!credentials.length) {
            return res.status(404).json({ status: 404, message: "No credentials found" });
        }

        return res.status(200).json({ status: 200, credentials });
    } catch (error) {
        console.error(`Error fetching device credentials: ${error.message}`);
        return res.status(500).json({ status: 500, error: "Internal Server Error" });
    }
};

module.exports={register, updateStackName,login,validuser,logout,sendPasswordLink,forgotPassword,changePassword, getAllUsers, editUser, deleteUser,
    getAUser,changeCurrentPassword,getDeviceCredentidals,getAllDeviceCredentials,getAUserByUserName,getAUserByCompanyName,getStackNamesByCompanyName,
    getStackNamesByUserName,updateAdminType,findUsersByAdminType
}