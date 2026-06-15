const express = require("express");
const router = express.Router();
const activityController = require("../controllers/activityController");
const authMiddleware = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/authMiddleware");

// Apply auth middleware to all routes
router.use(authMiddleware);

// Activity routes - Teachers can manage, admins can view all
router.post("/", authorize("superadmin", "school_admin", "teacher"), activityController.createActivity);
router.get("/", authorize("superadmin", "school_admin", "teacher"), activityController.getActivities);
router.get("/student-performance/:studentId", authorize("superadmin", "school_admin", "teacher"), activityController.getStudentPerformanceByCourse);
router.get("/class-performance", authorize("superadmin", "school_admin"), activityController.getClassPerformanceDashboard);
router.get("/course-analysis", authorize("superadmin", "school_admin"), activityController.getCoursePerformanceAnalysis);
router.get("/performance-report", authorize("superadmin", "school_admin"), activityController.getPerformanceReport);

module.exports = router;