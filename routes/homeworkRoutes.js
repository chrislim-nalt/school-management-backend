const express = require("express");
const router = express.Router();
const homeworkController = require("../controllers/homeworkController");
const authMiddleware = require("../middleware/authMiddleware");
const { authorize, isTeacher, isSchoolAdmin } = require("../middleware/authMiddleware");

// Apply auth middleware to all routes
router.use(authMiddleware);

// Homework routes
router.post("/assign", authorize("superadmin", "school_admin", "admin", "teacher", "staff"), homeworkController.assignHomework);
router.get("/", authorize("superadmin", "school_admin", "admin", "teacher", "staff"), homeworkController.getHomeworks);

// Homework submissions
router.get("/:homeworkId/submissions", authorize("superadmin", "school_admin", "admin", "teacher", "staff"), homeworkController.getHomeworkSubmissions);
router.post("/submit", authorize("superadmin", "school_admin", "admin", "teacher", "staff"), homeworkController.submitHomework);
router.post("/grade", authorize("superadmin", "school_admin", "admin", "teacher", "staff"), homeworkController.gradeHomework);

// Reports
router.get("/report", authorize("superadmin", "school_admin", "admin"), homeworkController.getHomeworkReport);
router.get("/summary", authorize("superadmin", "school_admin", "admin", "teacher", "staff"), homeworkController.getHomeworkSummary);

module.exports = router;