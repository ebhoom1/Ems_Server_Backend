const express = require("express");
const {
  register,
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
  getAllDeviceCredentials,
  getAUserByUserName,
  updateStackName,
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
  getAllOperators
} = require("../controllers/user");
const authenticate = require("../middleware/authenticate");
const User = require("../models/user");

const router = express.Router();

router.post("/register", register);
router.patch("/updateStackName/:companyName", updateStackName);
router.post("/login", login);
router.get("/validuser", authenticate, validuser);
router.get("/logout", authenticate, logout);
router.post("/sendpasswordlink", sendPasswordLink);
router.get("/forgotpassword/:id/:token", forgotPassword);
router.post("/:id/:token", changePassword);
router.get("/getallusers", getAllUsers);
router.patch("/edituser/:userId", editUser);
router.delete("/deleteuser/:userName", deleteUser);
router.get("/getauser/:userId", getAUser);
router.get("/get-user-by-userName/:userName", getAUserByUserName);
router.get("/get-user-by-companyName/:companyName", getAUserByCompanyName);
router.post("/changePassword/:userId/:token", changeCurrentPassword);
router.get(
  "/get-stacknames-by-companyName/:companyName",
  getStackNamesByCompanyName
);
router.get("/get-stacknames-by-userName/:userName", getStackNamesByUserName);
// Route to update adminType for a user
router.post("/update-admin-type", updateAdminType);
router.get("/get-users-by-adminType/:adminType", findUsersByAdminType);
router.get("/get-users-by-admin/:adminType", findUsersByAdminType);
// Route to get all admins
router.get("/get-territory-mangers", getTerritorialManagers);

// Route to get technicians and territory managers and operator
router.get("/getAll-technicians", getAllTechnicians);
router.get("/getAll-territory-managers", getAllTerritoryManagers);
router.get("/get-operators", getAllOperators);


// Route to delete technicians and territory managers
router.delete("/deleteTechnician/:id", deleteTechnician);
router.delete("/deleteTerritoryManager/:id", deleteTerritoryManager);
router.delete("/delete-operator/:id",deleteOperator);

router.get("/get-sites-for-user/:userId/:role", getSitesForUser);
router.get("/get-users-by-creator/:creatorId", getAllUsersByCreator);

router.get('/get-companies-by-operator/:operatorId', async (req, res) => {
  try {
    const companies = await User.find({ operators: req.params.operatorId });

    if (companies.length === 0) {
      return res.status(404).json({ message: "No companies found for this operator ID." });
    }

    res.json({ companies });
  } catch (err) {
    console.error("Error in /api/get-companies-by-operator:", err); // Log the actual error
    res.status(500).json({ message: "Server error: " + err.message });
  }
});

module.exports = router;
