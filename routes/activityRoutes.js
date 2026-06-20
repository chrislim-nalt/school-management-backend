const express = require("express");
const router = express.Router();
const activityController = require("../controllers/activityController");
const authMiddleware = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/authMiddleware");

// Apply auth middleware to all routes
router.use(authMiddleware);

// ==================== ASSIGN ACTIVITIES ====================
// Assign activity to an entire class (bulk creation)
router.post("/assign-to-class", 
  authorize("superadmin", "school_admin", "admin", "teacher", "staff"), 
  activityController.assignActivityToClass
);

// ==================== GET ACTIVITIES ====================
// Get activities for a specific class
router.get("/class", 
  authorize("superadmin", "school_admin", "admin", "teacher", "staff"), 
  activityController.getClassActivities
);

// Get performance dashboard for a class
router.get("/class-performance", 
  authorize("superadmin", "school_admin", "admin"), 
  activityController.getClassPerformanceDashboard
);

// Get activity trends
router.get("/trends", 
  authorize("superadmin", "school_admin", "admin", "teacher", "staff"), 
  activityController.getActivityTrends
);

// ==================== STUDENT SPECIFIC ====================
// Get activities for a single student
router.get("/student/:studentId", 
  authorize("superadmin", "school_admin", "admin", "teacher", "staff"), 
  activityController.getStudentActivities
);

// Update score for a specific student's activity
router.put("/update-score", 
  authorize("superadmin", "school_admin", "admin", "teacher", "staff"), 
  activityController.updateStudentScore
);

// ==================== LEGACY SUPPORT ====================
// Legacy: Get all activities (with filters)
router.get("/", 
  authorize("superadmin", "school_admin", "admin", "teacher", "staff"), 
  activityController.getActivities
);

// Legacy: Create single activity
router.post("/", 
  authorize("superadmin", "school_admin", "admin", "teacher", "staff"), 
  activityController.createActivity
);

// Legacy: Student performance by course
router.get("/student-performance/:studentId", 
  authorize("superadmin", "school_admin", "admin", "teacher", "staff"), 
  activityController.getStudentPerformanceByCourse
);

// Legacy: Course performance analysis
router.get("/course-analysis", 
  authorize("superadmin", "school_admin", "admin"), 
  activityController.getCoursePerformanceAnalysis
);

// Legacy: Performance report
router.get("/performance-report", 
  authorize("superadmin", "school_admin", "admin"), 
  activityController.getPerformanceReport
);

module.exports = router;