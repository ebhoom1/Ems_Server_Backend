const express = require("express");
const router = express.Router();
const {
  assignUser,
  markComplete,
  getAssignments,
  getCompletionStatusForAssignment,
  getAssignmentsByUser,
  UpdateEngineerVisitNo,
} = require("../controllers/assignmentController");

// POST: assign or update assignment
router.post("/assign", assignUser);

// PUT: mark assignment as completed
router.put("/assign/complete", markComplete);

// GET: optional route to fetch assignments
router.get("/assignments", getAssignments);
router.get(
  "/assignments/completion-status/:userId/:type/:month/:year",
  getCompletionStatusForAssignment
);
router.get("/assignments/by-assigned-to/:userId", getAssignmentsByUser);
router.post("/update-engineer-visits", UpdateEngineerVisitNo);


module.exports = router;