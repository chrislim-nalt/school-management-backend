const express = require("express");
const router = express.Router();
const englishPerformanceController = require("../controllers/englishPerformanceController");
const authMiddleware = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

router.use(authMiddleware);

// Record violation (Teacher/School Admin)
router.post("/violation", authorize(["teacher", "school_admin"]), englishPerformanceController.recordViolation);

// Class dashboard with charts
router.get("/class-dashboard", authorize(["teacher", "school_admin"]), englishPerformanceController.getClassEnglishDashboard);

// Student details
router.get("/student/:studentId", authorize(["teacher", "school_admin"]), englishPerformanceController.getStudentEnglishPerformance);

// Professional report
router.get("/report", authorize(["school_admin"]), englishPerformanceController.getEnglishPerformanceReport);

module.exports = router;