// controllers/inventoryController.js
const InventoryItem = require("../models/InventoryItems");

exports.addInventoryItem = async (req, res) => {
    try {
      const { userName, skuName, quantity, date } = req.body;
  
      // Basic validation (plantId removed)
      if (!userName || !skuName || quantity == null || !date) {
        return res.status(400).json({ error: "All fields are required." });
      }
  
      const newItem = new InventoryItem({
        userName,
        skuName,
        quantity,
        date,
      });
  
      const savedItem = await newItem.save();
      res.status(201).json({ message: "Inventory item added successfully", inventoryItem: savedItem });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
  //get all
  exports.getInventoryItems = async (req, res) => {
    try {
      const items = await InventoryItem.find();
      res.status(200).json({ inventoryItems: items });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
  //get by username
  exports.getInventoryByUser = async (req, res) => {
    try {
      const { userName } = req.query;
      
      if (!userName) {
        return res.status(400).json({ error: "userName parameter is required." });
      }
  
      const items = await InventoryItem.find({ userName: userName });
      res.status(200).json({ inventoryItems: items });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };


// Controller function to add a usage log
exports.addInventoryUsage = async (req, res) => {
    try {
      const { sku, quantityUsed, userName, usageDate, notes } = req.body;
  
      if (!sku || quantityUsed == null || !usageDate) {
        return res.status(400).json({ error: "SKU, quantityUsed and usageDate are required." });
      }
  
      // Find the inventory item by SKU (assuming skuName is unique)
      const item = await InventoryItem.findOne({ skuName: sku });
      if (!item) {
        return res.status(404).json({ error: "Inventory item not found for the given SKU." });
      }
  
      // Optionally check if available quantity is sufficient:
      // if (quantityUsed > item.quantity) {
      //   return res.status(400).json({ error: "Insufficient quantity available." });
      // }
  
      // Reduce the current quantity by the used amount
      item.quantity = item.quantity - quantityUsed;
      
      // Append the usage log with userName
      item.usageLog.push({
        userName,
        date: usageDate,
        quantityUsed,
        notes,
      });
  
      const updatedItem = await item.save();
      res.status(200).json({ message: "Usage log added successfully", updatedItem });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
  
  // Controller function to get usage logs
  // If a query parameter 'sku' is provided, it returns logs for that SKU; otherwise, it aggregates logs from all items.
  exports.getInventoryUsage = async (req, res) => {
    try {
      const { sku } = req.query;
      let usageLogs = [];
  
      if (sku) {
        const item = await InventoryItem.findOne({ skuName: sku });
        if (!item) {
          return res.status(404).json({ error: "Inventory item not found for the given SKU." });
        }
        // Map each usage log to include parent's userName and skuName
        usageLogs = item.usageLog.map(log => ({
          ...log.toObject(), // Convert the Mongoose subdocument to a plain object
          userName: item.userName,
          skuName: item.skuName,
        }));
      } else {
        // Aggregate usage logs from all inventory items, including parent's info
        const allItems = await InventoryItem.find();
        allItems.forEach(item => {
          item.usageLog.forEach(log => {
            usageLogs.push({
              ...log.toObject(),
              userName: item.userName,
              skuName: item.skuName,
            });
          });
        });
      }
      res.status(200).json({ usageLogs });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
  
  exports.getLeftQuantity = async (req, res) => {
    try {
      const { sku } = req.query;
      if (!sku) {
        return res.status(400).json({ error: "SKU is required." });
      }
  
      // Find the inventory item by SKU (assuming skuName is unique)
      const item = await InventoryItem.findOne({ skuName: sku });
      if (!item) {
        return res.status(404).json({ error: "Inventory item not found for the given SKU." });
      }
  
      // The current quantity already reflects all usage reductions
      // So we can just return it directly
      res.status(200).json({ leftQuantity: item.quantity });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
  // Get inventory by adminType
exports.getInventoryByAdminType = async (req, res) => {
  const { adminType } = req.params;

  if (!adminType) {
    return res.status(400).json({ error: "Please provide an adminType" });
  }

  try {
    const User = require('../models/user'); // Import User model
    
    let userNames = [];
    
    if (adminType === 'EBHOOM') {
      // For EBHOOM, get all inventory items
      const items = await InventoryItem.find().sort({ date: -1 });
      return res.status(200).json({
        message: `Inventory items fetched for adminType: ${adminType}`,
        count: items.length,
        inventoryItems: items
      });
    } else {
      // For other adminTypes, first get users with that adminType
      const users = await User.find(
        { adminType, userType: 'user' },
        { userName: 1, _id: 0 }
      ).lean();

      if (!users || users.length === 0) {
        return res.status(200).json({
          message: "No inventory found - no users for this adminType",
          inventoryItems: []
        });
      }

      userNames = users.map(user => user.userName);
      
      // Then get inventory items for these users
      const items = await InventoryItem.find({ 
        userName: { $in: userNames } 
      }).sort({ date: -1 });

      res.status(200).json({
        message: `Inventory items fetched for adminType: ${adminType}`,
        count: items.length,
        inventoryItems: items
      });
    }
  } catch (error) {
    console.error(`Error fetching inventory by adminType: ${error.message}`);
    res.status(500).json({ 
      message: "Error fetching inventory by adminType",
      error: error.message 
    });
  }
};

// Get inventory usage by adminType
exports.getInventoryUsageByAdminType = async (req, res) => {
  const { adminType } = req.params;

  if (!adminType) {
    return res.status(400).json({ error: "Please provide an adminType" });
  }

  try {
    const User = require('../models/user');
    let usageLogs = [];
    
    if (adminType === 'EBHOOM') {
      // For EBHOOM, get all usage logs
      const allItems = await InventoryItem.find();
      allItems.forEach(item => {
        item.usageLog.forEach(log => {
          usageLogs.push({
            ...log.toObject(),
            userName: item.userName,
            skuName: item.skuName,
            currentQuantity: item.quantity // Include current quantity
          });
        });
      });
    } else {
      // For other adminTypes, first get users with that adminType
      const users = await User.find(
        { adminType, userType: 'user' },
        { userName: 1, _id: 0 }
      ).lean();

      if (!users || users.length === 0) {
        return res.status(200).json({
          message: "No usage logs found - no users for this adminType",
          usageLogs: []
        });
      }

      const userNames = users.map(user => user.userName);
      
      // Then get usage logs for these users
      const items = await InventoryItem.find({ userName: { $in: userNames } });
      items.forEach(item => {
        item.usageLog.forEach(log => {
          usageLogs.push({
            ...log.toObject(),
            userName: item.userName,
            skuName: item.skuName,
            currentQuantity: item.quantity
          });
        });
      });
    }

    // Sort by usage date (newest first)
    usageLogs.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.status(200).json({
      message: `Usage logs fetched for adminType: ${adminType}`,
      count: usageLogs.length,
      usageLogs
    });

  } catch (error) {
    console.error(`Error fetching usage logs by adminType: ${error.message}`);
    res.status(500).json({ 
      message: "Error fetching usage logs by adminType",
      error: error.message 
    });
  }
};