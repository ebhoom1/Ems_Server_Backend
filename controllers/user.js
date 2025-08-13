const express = require("express");
const userdb = require("../models/user");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const authenticate = require("../middleware/authenticate");

const mongoose = require("mongoose");

const keysecret = process.env.SECRET_KEY;

//email config
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  service: "gmail",
  auth: {
    user: process.env.EMAIl,
    pass: process.env.PASSWORD,
  },
});

const register = async (req, res) => {
  console.log("rquest body:", req.body);
  const {
    userName,
    companyName,
    modelName,
    fname,
    email,
    mobileNumber,
    password,
    cpassword,
    subscriptionDate,
    subscriptionPlan,
    userType,
    adminType,
    industryType,
    industryPollutionCategory,
    dataInteval,
    district,
    state,
    address,
    latitude,
    longitude,
    productID,
    additionalEmails, // expect an array of additional emails
    territorialManager,
    technicians,
    isTerritorialManager,
    isTechnician,
    isOperator,
    createdBy,
    operators, // ✅ ADD THIS
  } = req.body;
//try block
  try {
    // Check if primary email is already used
    const preuser = await userdb.findOne({ email });
    if (preuser) {
      return res.status(422).json({ error: "This Email Already Registered" });
    }

    if (userType !== "admin" && password !== cpassword) {
      return res
        .status(422)
        .json({ error: "Password and Confirm Password do not match" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12);

    //  Prepare user object
    const userObject = {
      userName,
      companyName,
      modelName,
      fname,
      email,
      additionalEmails, // Save the array of additional emails
      password: hashedPassword,
      cpassword,
      userType,
      adminType,
      industryType,
      industryPollutionCategory,
      dataInteval,
      district,
      state,
      address,
      territorialManager,
     technicians: technicians || [],
      isTerritorialManager,
      isTechnician,
      isOperator: userType === "operator" ? true : isOperator,
      operators: operators || [], // ✅ new
      createdBy:  createdBy, // Set the creator's userId
    };

    // Set iotLastEnterDate always to today's date
    userObject.iotLastEnterDate = new Date().toISOString().split("T")[0];

    // Only for non-technicians: handle subscription
    if (userType !== "admin") {
      userObject.mobileNumber = mobileNumber;
      userObject.latitude = latitude;
      userObject.longitude = longitude;
      userObject.productID = productID;

      const subscriptionDateObj =
        subscriptionDate && !isNaN(new Date(subscriptionDate))
          ? new Date(subscriptionDate)
          : new Date();
      const endSubscriptionDateObj = new Date(subscriptionDateObj);
      endSubscriptionDateObj.setMonth(subscriptionDateObj.getMonth() + 1);

      userObject.subscriptionDate = subscriptionDateObj
        .toISOString()
        .split("T")[0];
      userObject.endSubscriptionDate = endSubscriptionDateObj
        .toISOString()
        .split("T")[0];
      userObject.subscriptionActive = true;
    }
    const finalUser = new userdb(userObject);
    const storeData = await finalUser.save();
    return res.status(201).json({ status: 201, storeData });
  } catch (error) {
    console.log(`Error : ${error}`);
    return res.status(400).json(error);
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
    return res
      .status(200)
      .json({ message: "Stack names updated", updatedUser });
  } catch (error) {
    console.error(`Error updating stack names: ${error.message}`);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

const updateAdminType = async (req, res) => {
  const { userName, adminType } = req.body;

  if (!userName || !adminType) {
    return res
      .status(400)
      .json({ error: "Please provide both userName and adminType" });
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
      return res
        .status(409)
        .json({ error: "AdminType is already set for this user" });
    }

    // Update the adminType
    user.adminType = adminType;

    // Save the updated user
    await user.save();

    return res
      .status(200)
      .json({ status: 200, message: "AdminType updated successfully", user });
  } catch (error) {
    console.error(`Error in updating adminType: ${error.message}`);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// user login
const login = async (req, res) => {
  const { email, password, userType } = req.body;
  if (!email || !password || !userType) {
    return res.status(422).json({ error: "Fill all the details" });
  }

  try {
    // ── Operator login ──
  if (userType === "operator") {
  const operator = await userdb.findOne({ email });

  if (!operator || operator.userType !== "operator") {
    return res.status(401).json({ status: 401, message: "Invalid details" });
  }

  const isMatch = await bcrypt.compare(password, operator.password);
  if (!isMatch) {
    return res.status(422).json({ error: "Invalid User" });
  }

  const token = jwt.sign({ _id: operator._id }, keysecret, {
    expiresIn: "30d",
  });
  operator.tokens = [{ token }];
  await operator.save();

  res.cookie("usercookie", token, {
    expires: new Date(Date.now() + 9000000),
    httpOnly: true,
  });

  return res.status(200).json({
    status: 200,
    message: "Operator login successful",
    result: { user: operator, token },
  });
}


    // ── Technician login ──
    if (userType === "admin") {
      const technician = await userdb.findOne({ email });
      console.log("Password entered:", password);
      console.log("Password in database (hashed):", technician.password);

      if (!technician) {
        return res
          .status(401)
          .json({ status: 401, message: "Invalid details" });
      }

      if (technician.userType !== "admin") {
        return res.status(401).json({ error: "Invalid UserType" });
      }

      const isMatch = await bcrypt.compare(password, technician.password);
      // Since no hashing: direct string match
      //   const isMatch = password === technician.password;
      if (!isMatch) {
        return res.status(422).json({ error: "Invalid User" });
      }

      const token = jwt.sign({ _id: technician._id }, keysecret, {
        expiresIn: "30d",
      });
      technician.tokens = [{ token }];
      await technician.save();

      res.cookie("usercookie", token, {
        expires: new Date(Date.now() + 9000000),
        httpOnly: true,
      });

      return res.status(200).json({
        status: 200,
        message: "Technician login successful",
        result: { user: technician, token },
      });
    }

    // ── Admin/User login (unchanged) ──
    const userValid = await userdb.findOne({
      $or: [{ email: email }, { additionalEmails: email }],
    });
    if (!userValid) {
      return res.status(401).json({ status: 401, message: "Invalid details" });
    }
    if (userValid.userType !== userType) {
      return res.status(401).json({ error: "Invalid UserType" });
    }
    const isMatch = await bcrypt.compare(password, userValid.password);
    if (!isMatch) {
      return res.status(422).json({ error: "Invalid User" });
    }
    const token = jwt.sign({ _id: userValid._id }, keysecret, {
      expiresIn: "30d",
    });
    userValid.tokens = [{ token }];
    await userValid.save();
    res.cookie("usercookie", token, {
      expires: new Date(Date.now() + 9000000),
      httpOnly: true,
    });
    return res.status(200).json({
      status: 200,
      message: "Login Successful",
      result: { user: userValid, token },
    });
  } catch (error) {
    console.error(`Error: ${error}`);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// get all technicians
const getAllTechnicians = async (req, res) => {
  try {
    const technicians = await userdb.find({ isTechnician: true });
    res.status(200).json({ status: 200, users: technicians });
  } catch (error) {
    console.error(`Error: ${error}`);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// get all territory managers
const getAllTerritoryManagers = async (req, res) => {
  try {
    const managers = await userdb.find({ isTerritorialManager: true });
    res.status(200).json({ status: 200, users: managers });
  } catch (error) {
    console.error(`Error: ${error}`);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// delete  technician
const deleteTechnician = async (req, res) => {
  console.log(req.params.id);
  try {
    const user = await userdb.findOne({
      _id: req.params.id,
      isTechnician: true,
    });
    if (!user) {
      return res
        .status(404)
        .json({ status: 404, message: "Technician not found" });
    }

    await userdb.findByIdAndDelete(req.params.id);
    res
      .status(200)
      .json({ status: 200, message: "Technician deleted successfully" });
  } catch (error) {
    console.error(`Error deleting technician: ${error.message}`);
    return res
      .status(500)
      .json({ status: 500, error: "Internal Server Error" });
  }
};

const deleteTerritoryManager = async (req, res) => {
  try {
    const user = await userdb.findOne({
      _id: req.params.id,
      isTerritorialManager: true,
    });
    if (!user) {
      return res
        .status(404)
        .json({ status: 404, message: "Territorial Manager not found" });
    }

    await userdb.findByIdAndDelete(req.params.id);
    res
      .status(200)
      .json({
        status: 200,
        message: "Territorial Manager deleted successfully",
      });
  } catch (error) {
    console.error(`Error deleting territory Manager: ${error.message}`);
    return res
      .status(500)
      .json({ status: 500, error: "Internal Server Error" });
  }
};

// user Valid

const validuser = async (req, res) => {
  try {
    const validUserOne = await userdb.findOne({ _id: req.userId });
    return res.status(201).json({ status: 201, validUserOne });
  } catch (error) {
    return res.status(401).json({ status: 401, error });
  }
};

//user logout
const logout = async (req, res) => {
  try {
    req.rootUser.tokens = req.rootUser.tokens.filter((curelem) => {
      return curelem.token !== req.token;
    });
    await req.rootUser.save();

    res.clearCookie("usercookie", { path: "/" });

    return res.status(201).json({ status: 201 });
  } catch (error) {
    return res.status(401).json({ status: 401, error });
    console.log(error);
  }
};

// send email Link for reset Password

const sendPasswordLink = async (req, res) => {
  console.log(req.body);

  const { email } = req.body;

  if (!email) {
    res.status(401).json({ status: 401, message: "Enter your Email" });
  }
  try {
    const userfind = await userdb.findOne({ email: email });

    //token generate for reset password
    const token = jwt.sign({ _id: userfind._id }, keysecret, {
      expiresIn: "1d",
    });

    const setusertoken = await userdb.findByIdAndUpdate(
      { _id: userfind._id },
      { verifytoken: token },
      { new: true }
    );

    if (setusertoken) {
      const mailOptions = {
        from: process.env.EMAIl,
        to: email,
        subject: "Sending Email for Password Reset",
        text: `This Link Valid for 2 Minutes http://ocems.ebhoom.com:5555/reset-password/${userfind._id}/${setusertoken.verifytoken}`,
      };
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.log("error", error);
          res.status(401).json({ status: 401, message: "Email not send" });
        } else {
          console.log("Email send", info.response);
          res
            .status(201)
            .json({ status: 201, message: "Email sent Successfully" });
        }
      });
    }
  } catch (error) {
    res.status(401).json({ status: 401, message: "Invalid User" });
  }
};
// verify user for forgot password time
const forgotPassword = async (req, res) => {
  const { id, token } = req.params;

  try {
    const validuser = await userdb.findOne({ _id: id, verifytoken: token });

    const verifytoken = jwt.verify(token, keysecret);
    console.log(verifytoken);

    if (validuser && verifytoken._id) {
      res.status(201).json({ status: 201, validuser });
    } else {
      res.status(401).json({ status: 401, message: "User not exist" });
    }
  } catch (error) {
    res.status(401).json({ status: 401, error });
  }
};

//change password

const changePassword = async (req, res) => {
  const { id, token } = req.params;
  const { password, cpassword } = req.body;

  if (password !== cpassword) {
    return res.status(422).json({
      status: 422,
      message: "New password and confirmation password do not match",
    });
  }

  try {
    // Check if the token exists in the tokens array
    const user = await userdb.findOne({
      _id: id,
      "tokens.token": token, // Search for token in tokens array
    });

    if (!user) {
      return res
        .status(401)
        .json({ status: 401, message: "User not found or invalid token" });
    }

    // Verify the token
    jwt.verify(token, process.env.SECRET_KEY);

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update the password
    await userdb.updateOne({ _id: id }, { $set: { password: hashedPassword } });

    return res
      .status(200)
      .json({ status: 200, message: "Password changed successfully" });
  } catch (error) {
    console.error(`Error changing password: ${error.message}`);
    return res
      .status(500)
      .json({ status: 500, error: "Internal Server Error" });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await userdb
      .find({}, { password: 0, cpassword: 0 })
      .lean()
      .exec(); // Exclude sensitive fields
    if (users.length === 0) {
      return res.status(404).json({ status: 404, message: "No users found" });
    }
    return res.status(200).json({ status: 200, users });
  } catch (error) {
    console.error(`Error fetching users: ${error.message}`);
    return res
      .status(500)
      .json({ status: 500, error: "Internal Server Error" });
  }
};

// edit user
// edit user
const editUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const updateFields = { ...req.body };

    // Use $set so that the incoming `technicians: [...]` array replaces the existing array
    const updatedUser = await userdb
      .findByIdAndUpdate(
        userId,
        { $set: updateFields },
        { new: true, lean: true }
      )
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

    return res
      .status(200)
      .json({ status: 200, message: "User Deleted Successfully" });
  } catch (error) {
    console.error(`Error deleting user: ${error.message}`);
    return res
      .status(500)
      .json({ status: 500, error: "Internal Server Error" });
  }
};

// Get A User

const getAUser = async (req, res) => {
  try {
    let { userId } = req.params;

    // Trim the userId to remove unwanted spaces or newlines
    userId = userId.trim();

    console.log(`Fetching user with ID: "${userId}"`);

    // Validate if userId is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ status: 400, message: "Invalid User ID" });
    }

    const user = await userdb.findById(userId, { password: 0 }).lean();

    if (!user) {
      return res.status(404).json({ status: 404, message: "User Not Found" });
    }

    return res.status(200).json({ status: 200, user });
  } catch (error) {
    console.error(`Error fetching user:`, error);
    return res
      .status(500)
      .json({ status: 500, error: error.message || "Internal Server Error" });
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
    return res
      .status(500)
      .json({ status: 500, error: "Internal Server Error" });
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
    return res
      .status(500)
      .json({ status: 500, error: "Internal Server Error" });
  }
};

// Get all territory managers
const getTerritorialManagers = async (req, res) => {
  try {
    const territorialManagers = await userdb
      .find({
        userType: "admin",
        isTerritorialManager: true, // Only those admins who are territorial managers
      })
      .select("userName email fname adminType");

    res.status(200).json({ admins: territorialManagers });
  } catch (error) {
    console.error(`Error fetching territorial managers:`, error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

const getStackNamesByCompanyName = async (req, res) => {
  try {
    const { companyName } = req.params;

    // Fetch only stackName field
    const user = await userdb.findOne({ companyName }, { stackName: 1 }).lean();

    if (!user || !user.stackName?.length) {
      return res
        .status(404)
        .json({ status: 404, message: "No stack names found" });
    }

    return res.status(200).json({ status: 200, stackNames: user.stackName });
  } catch (error) {
    console.error(`Error fetching stack names: ${error.message}`);
    return res
      .status(500)
      .json({ status: 500, error: "Internal Server Error" });
  }
};

const getStackNamesByUserName = async (req, res) => {
  try {
    const { userName } = req.params;

    const user = await userdb.findOne({ userName }, { stackName: 1 }).lean();

    if (!user || !user.stackName?.length) {
      return res
        .status(404)
        .json({ status: 404, message: "No stack names found" });
    }

    return res.status(200).json({ status: 200, stackNames: user.stackName });
  } catch (error) {
    console.error(`Error fetching stack names by username: ${error.message}`);
    return res
      .status(500)
      .json({ status: 500, error: "Internal Server Error" });
  }
};

const findUsersByAdminType = async (req, res) => {
  const { adminType } = req.params;
  const { territorialManagerId, isTerritorialManager } = req.query;

  if (!adminType) {
    return res.status(400).json({ error: "Please provide an adminType" });
  }

  try {
    let query = { userType: "user" };

    if (adminType === "EBHOOM") {
      // EBHOOM sees all users
      query = { userType: "user" };
    } else if (isTerritorialManager === "true" && territorialManagerId) {
      // If user is a Territorial Manager, show only users assigned to them
      query.territorialManager = new mongoose.Types.ObjectId(
        territorialManagerId
      );
    } else {
      // Fallback: Regular admin sees users by adminType
      query.adminType = adminType;
    }

    console.log("MongoDB Query:", query);

    // Find users based on the constructed query
    const users = await userdb
      .find(query, {
        password: 0, // Exclude sensitive fields
        tokens: 0, // Exclude tokens for security
      })
      .lean();

    if (!users || users.length === 0) {
      return res
        .status(404)
        .json({ message: "No users found matching the criteria" });
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
    return res
      .status(422)
      .json({ status: 422, message: "Passwords do not match" });
  }

  try {
    // Check if the token exists in the tokens array and fetch the user
    const user = await userdb.findOne({
      _id: userId,
      "tokens.token": token, // Search for token in tokens array
    });

    if (!user) {
      return res
        .status(401)
        .json({ status: 401, message: "User not found or invalid token" });
    }

    // Validate the current password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ status: 401, message: "Current password is incorrect" });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the password
    await userdb.updateOne(
      { _id: userId },
      { $set: { password: hashedPassword } }
    );

    return res
      .status(200)
      .json({ status: 200, message: "Password changed successfully" });
  } catch (error) {
    console.error(`Error changing password: ${error.message}`);
    return res
      .status(500)
      .json({ status: 500, error: "Internal Server Error" });
  }
};

const getDeviceCredentidals = async (userId) => {
  try {
    const user = await userdb.findById(userId);
    if (!user || !user.deviceCredentials) {
      throw new Error("Device credentials not found for this user");
    }
    return user.deviceCredentials;
  } catch (error) {
    console.error(`Error fetching device credentials:`, error);
    throw error;
  }
};
const getAllDeviceCredentials = async (req, res) => {
  try {
    const credentials = await userdb
      .find(
        {},
        {
          userName: 1,
          email: 1,
          mobileNumber: 1,
          companyName: 1,
          industryType: 1,
          productID: 1,
        }
      )
      .lean();

    if (!credentials.length) {
      return res
        .status(404)
        .json({ status: 404, message: "No credentials found" });
    }

    return res.status(200).json({ status: 200, credentials });
  } catch (error) {
    console.error(`Error fetching device credentials: ${error.message}`);
    return res
      .status(500)
      .json({ status: 500, error: "Internal Server Error" });
  }
};
// delete operator
const deleteOperator = async (req, res) => {
  try {
    const user = await userdb.findOne({
      _id: req.params.id,
      isOperator: true,
    });

    if (!user) {
      return res
        .status(404)
        .json({ status: 404, message: "Operator not found" });
    }

    await userdb.findByIdAndDelete(req.params.id);
    res.status(200).json({
      status: 200,
      message: "Operator deleted successfully",
    });
  } catch (error) {
    console.error(`Error deleting operator: ${error.message}`);
    return res
      .status(500)
      .json({ status: 500, error: "Internal Server Error" });
  }
};
const getSitesForUser = async (req, res) => {
  try {
    const { userId, role } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    let query = {};

    if (role === "operator") {
      query = { operators: new mongoose.Types.ObjectId(userId) };
    } else if (role === "territorialManager") {
      query = { territorialManager: new mongoose.Types.ObjectId(userId) };
    } else if (role === "technician") {
      query = { technician: new mongoose.Types.ObjectId(userId) }; // if technician field is added later
    } else {
      return res.status(400).json({ message: "Unsupported role" });
    }

    const matchedSites = await userdb.find({
      ...query,
      latitude: { $exists: true },
      longitude: { $exists: true },
    }).select("latitude longitude companyName");

    if (matchedSites.length === 0) {
      return res.status(404).json({ message: "No sites found for this user" });
    }

    return res.json(matchedSites);
  } catch (error) {
    console.error("❌ Site fetch error:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};

const getAllUsersByCreator = async (req,res) => {
  try {
    const users = await userdb.find({ createdBy: req.params.creatorId });
    res.status(200).json({ users });
  } catch (err) {
     console.error(`Error fetching user by createdBy: ${error.message}`);
    return res
      .status(500)
      .json({ status: 500, error: "Internal Server Error" });
  }
}
//get all operator

const getAllOperators = async (req, res) => {
  try {
    const operators = await userdb.find({ isOperator: true }).select("-password -cpassword -tokens").lean();
    if (!operators || operators.length === 0) {
      return res.status(404).json({ status: 404, message: "No operators found" });
    }
    return res.status(200).json({ status: 200, users: operators });
  } catch (error) {
    console.error(`Error fetching operators: ${error.message}`);
    return res.status(500).json({ status: 500, error: "Internal Server Error" });
  }
};
const getCompaniesByTerritorialManager = async (req, res) => {
  try {
    const { managerId } = req.params;

    // Optional: Validate the managerId as a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(managerId)) {
      return res.status(400).json({ success: false, message: 'Invalid Territorial Manager ID format.' });
    }

    // Find users (companies) where the 'territorialManager' field matches the managerId
    // and the userType is 'user' (assuming 'user' type represents companies/clients)
    const companies = await userdb.find({ // <--- CHANGE THIS LINE FROM 'User.find' TO 'userdb.find'
      territorialManager: managerId,
      userType: "user" // Adjust this if your 'company' userType is different
    }).select('_id userName companyName'); // Select only necessary fields for the frontend dropdown

    if (!companies || companies.length === 0) {
      return res.status(404).json({ success: false, message: 'No companies found for this territorial manager.' });
    }

    res.status(200).json({ success: true, companies });

  } catch (error) {
    console.error("Error fetching companies by territorial manager:", error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

//new for fault alert
const getUsersByAdminTypeQuery = async (req, res) => {
  try {
    const { adminType } = req.query;
    if (!adminType) {
      return res.status(400).json({ error: "adminType query param is required" });
    }

    // requester info (optional but recommended): use your existing authenticate middleware
    let requester = null;
    if (req.userId) {
      requester = await userdb.findById(req.userId).lean();
    }

    // base query: only real site users
    let query = { userType: "user" };

    // EBHOOM super-admin can see all
    const isEbhoom = (requester?.adminType === "EBHOOM") || (adminType === "EBHOOM");
    if (!isEbhoom) {
      // If requester is a Territorial Manager, show only assigned users
      if (requester?.isTerritorialManager) {
        query.territorialManager = new mongoose.Types.ObjectId(requester._id);
      } else {
        // Regular admin: match by adminType
        query.adminType = adminType;
      }
    }

    // keep payload light – return what the frontend needs to join rooms
    const users = await userdb
      .find(query, {
        _id: 1,
        userName: 1,
        companyName: 1,
        adminType: 1,
        userType: 1,
        productID: 1,
        email: 1,
      })
      .lean();

    return res.status(200).json(users);
  } catch (err) {
    console.error("getUsersByAdminTypeQuery error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};


module.exports = {
  register,
  updateStackName,
  login,
  validuser,
  logout,
  sendPasswordLink,
  forgotPassword,
  changePassword,
  getAllUsers,
  editUser,
  deleteUser,
  getAUser,
  changeCurrentPassword,
  getDeviceCredentidals,
  getAllDeviceCredentials,
  getAUserByUserName,
  getAUserByCompanyName,
  getStackNamesByCompanyName,
  getStackNamesByUserName,
  updateAdminType,
  findUsersByAdminType,
  getTerritorialManagers,
  getAllTechnicians,
  getAllTerritoryManagers,
  deleteTechnician,
  deleteTerritoryManager,
  deleteOperator,
  getSitesForUser,
  getAllUsersByCreator,
  getAllOperators,
  getCompaniesByTerritorialManager,
  getUsersByAdminTypeQuery
};