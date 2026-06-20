const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/authMiddleware");

// Import the controller - MAKE SURE ALL FUNCTIONS EXIST
const markController = require("../controllers/markController");

// Apply auth middleware to all routes
router.use(authMiddleware);

// ==================== GET MARKS ====================
// Get marks with filters (legacy)
router.get("/", authorize("superadmin", "school_admin", "admin", "teacher", "staff"), markController.getMarks);

// Get marks for a specific class and course
router.get("/class", authorize("superadmin", "school_admin", "admin", "teacher", "staff"), markController.getClassMarks);

// Get students for a class
router.get("/class-students", authorize("superadmin", "school_admin", "admin", "teacher", "staff"), markController.getClassStudents);

// Get student marks
router.get("/student/:studentId", authorize("superadmin", "school_admin", "admin", "teacher", "staff"), markController.getStudentMarks);

// ==================== CREATE/UPDATE MARKS ====================
// Bulk upsert marks for a class
router.post("/bulk-class", authorize("superadmin", "school_admin", "admin", "teacher", "staff"), markController.bulkUpsertClassMarks);

// Legacy: Bulk upsert marks
router.post("/bulk", authorize("superadmin", "school_admin", "admin", "teacher", "staff"), markController.bulkUpsertMarks);

// ==================== ANALYTICS ====================
// Get analytics
router.get("/analytics", authorize("superadmin", "school_admin", "admin", "teacher", "staff"), markController.getMarksAnalytics);

// ==================== DELETE ====================
// Delete a mark
router.delete("/:id", authorize("superadmin", "school_admin", "admin"), markController.deleteMark);

module.exports = router;