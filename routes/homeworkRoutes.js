const express = require("express");
const router = express.Router();
const homeworkController = require("../controllers/homeworkController");
const authMiddleware = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/authMiddleware");

// Apply auth middleware to all routes
router.use(authMiddleware);

// Homework routes - Teachers can assign/grade, admins can view all
router.post("/assign", authorize("superadmin", "school_admin", "teacher"), homeworkController.assignHomework);
router.get("/", authorize("superadmin", "school_admin", "teacher"), homeworkController.getHomeworks);
router.get("/:homeworkId/submissions", authorize("superadmin", "school_admin", "teacher"), homeworkController.getHomeworkSubmissions);
router.post("/submit", authorize("superadmin", "school_admin", "teacher"), homeworkController.submitHomework);
router.post("/grade", authorize("superadmin", "school_admin", "teacher"), homeworkController.gradeHomework);
router.get("/report", authorize("superadmin", "school_admin"), homeworkController.getHomeworkReport);

module.exports = router;