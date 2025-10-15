const Assignment = require("../models/Assignment");const 
ElectricalReport = require("../models/ElectricalReport");
const MechanicalReport = require("../models/MechanicalReport");
const User=require("../models/user")
const Equipment = require("../models/equipment");


exports.getCompletionStatusForAssignment = async (req, res) => {
    const { userId, type, month, year } = req.params;
    const m = parseInt(month);
    const y = parseInt(year);
  
    try {
      // Validate report type
      if (type !== "EPM" && type !== "MPM") {
        return res.status(400).json({ success: false, message: "Invalid report type" });
      }
  
      const startDate = new Date(y, m - 1, 1);
      const endDate = new Date(y, m, 1);
  
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }
  
      const equipments = await Equipment.find({ userName: user.userName });
      const equipmentIds = equipments.map((e) => e._id.toString());
  
      let isComplete = false;
  
      if (type === "EPM") {
        const reports = await ElectricalReport.find({
          equipmentId: { $in: equipmentIds },
          createdAt: { $gte: startDate, $lt: endDate },
        });
  
        const submittedIds = reports.map((r) => r.equipmentId.toString());
        isComplete = equipmentIds.every((id) => submittedIds.includes(id));
      }
  
      if (type === "MPM") {
        const reports = await MechanicalReport.find({
          equipmentId: { $in: equipmentIds },
          timestamp: { $gte: startDate, $lt: endDate },
        });
  
        const submittedIds = reports.map((r) => r.equipmentId.toString());
        isComplete = equipmentIds.every((id) => submittedIds.includes(id));
      }
  
      // ✅ Update status in Assignment collection if complete
      if (isComplete) {
        await Assignment.findOneAndUpdate(
          { userId, type, month: m, year: y },
          { status: "Completed" }
        );
      }
  
      // ✅ Send the response to frontend
      return res.json({ completed: isComplete });
  
    } catch (err) {
      console.error("Completion check error", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  };

  exports.getAssignmentsByUser = async (req, res) => {
    try {
      const { userId } = req.params;
  
      // Find all assignments where current user is assigned (as technician or TM)
      const assignments = await Assignment.find({ assignedToId: userId });
  
      // Get userIds from assignments
      const userIds = assignments.map(a => a.userId);
  
      // Find users to get their userNames
      const users = await User.find({ _id: { $in: userIds } });
  
      // Return userNames only
      const assignedUserNames = users.map(u => u.userName);
  
      res.json({ success: true, assignedUserNames });
    } catch (err) {
      console.error("Error fetching assigned users", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  };
// Create or update assignment
exports.assignUser = async (req, res) => {
      try {
        const {
          userId,
          assignedToId,
          assignedToName,
          type,
          status,
          year,
          month,
          assignedBy,        // new
          assignedByName,    // new
        } = req.body;
    
        let existing = await Assignment.findOne({ userId, type, year, month });
    
        if (existing) {
          existing.assignedToId = assignedToId;
          existing.assignedToName = assignedToName;
          existing.assignedBy = assignedBy;
          existing.assignedByName = assignedByName;
          existing.status = status || "Assigned";
          await existing.save();
    
          return res.status(200).json({ success: true, message: "Assignment updated", data: existing });
        }
    
        const newAssign = new Assignment({
          userId,
          assignedToId,
          assignedToName,
          assignedBy,
          assignedByName,
          type,
          status: status || "Assigned",
          year,
          month,
        });
    
        await newAssign.save();
        res.status(201).json({ success: true, message: "Assignment created", data: newAssign });
      } catch (error) {
        console.error("Assign error:", error);
        res.status(500).json({ success: false, message: "Server error" });
      }
    };
    

// Mark assignment as complete
exports.markComplete = async (req, res) => {
  try {
    const { userId, type, year, month } = req.body;

    const assign = await Assignment.findOne({ userId, type, year, month });

    if (!assign) {
      return res.status(404).json({ success: false, message: "Assignment not found" });
    }

    assign.status = "Completed";
    await assign.save();

    res.status(200).json({ success: true, message: "Marked as completed", data: assign });
  } catch (error) {
    console.error("Complete error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// Optional: Fetch all assignments for a given year/month
exports.getAssignments = async (req, res) => {
    try {
      const { year, month } = req.query;
      const query = {};
      if (year) query.year = Number(year);
      if (month) query.month = Number(month);
  
      const assignments = await Assignment.find(query).lean();
  
      res.status(200).json({ success: true, data: assignments });
    } catch (error) {
      console.error("Fetch assignments error:", error);
      res.status(500).json({ success: false, error: "Server error" });
    }
  };


  exports.UpdateEngineerVisitNo=async(req,res)=>{
 try {
    const { userId, selectedVisits } = req.body;

    if (!userId)
      return res.status(400).json({ message: "Missing userId" });

    await User.findByIdAndUpdate(
      userId,
      { $set: { selectedVisits } },
      { new: true }
    );

    res.json({
      success: true,
      message: "Engineer visit selections updated successfully",
      data: selectedVisits,
    });
  } catch (error) {
    console.error("Error updating engineer visits:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
}
  