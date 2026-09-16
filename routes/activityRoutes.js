const express = require("express");
const router = express.Router();
const activityController = require("../controllers/activityController");
const authMiddleware = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/authMiddleware");
const Activity = require("../models/Activity"); // FIX: was missing, caused ReferenceError on /update-slow-learner/:activityId

// Apply auth middleware to all routes
router.use(authMiddleware);

// ==================== ASSIGN ACTIVITIES ====================
router.post("/assign-to-class", 
  authorize("superadmin", "school_admin", "admin", "teacher", "staff"), 
  activityController.assignActivityToClass
);

// ==================== GET ACTIVITIES ====================
router.get("/class", 
  authorize("superadmin", "school_admin", "admin", "teacher", "staff"), 
  activityController.getClassActivities
);

// School-wide recent activity feed for dashboards (no grade/className filter required)
router.get("/recent", 
  authorize("superadmin", "school_admin", "admin", "teacher", "staff"), 
  activityController.getRecentActivities
);

// Distinct dates that have assigned activities, for the "previous dates" dropdown
router.get("/dates", 
  authorize("superadmin", "school_admin", "admin", "teacher", "staff"), 
  activityController.getActivityDates
);

// Edit an already-assigned activity's details (title, instructions, max score, type, date)
router.put("/batch/:batchId", 
  authorize("superadmin", "school_admin", "admin", "teacher", "staff"), 
  activityController.updateActivityBatch
);

// Delete an already-assigned activity (all student records under it)
router.delete("/batch/:batchId", 
  authorize("superadmin", "school_admin", "admin", "teacher", "staff"), 
  activityController.deleteActivityBatch
);

// Save marks for every student in an assigned activity in a single request
router.put("/batch/:batchId/scores", 
  authorize("superadmin", "school_admin", "admin", "teacher", "staff"), 
  activityController.bulkUpdateBatchScores
);

router.get("/class-performance", 
  authorize("superadmin", "school_admin", "admin"), 
  activityController.getClassPerformanceDashboard
);

router.get("/trends", 
  authorize("superadmin", "school_admin", "admin", "teacher", "staff"), 
  activityController.getActivityTrends
);

// ==================== STUDENT SPECIFIC ====================
router.get("/student/:studentId", 
  authorize("superadmin", "school_admin", "admin", "teacher", "staff"), 
  activityController.getStudentActivities
);

router.put("/update-score", 
  authorize("superadmin", "school_admin", "admin", "teacher", "staff"), 
  activityController.updateStudentScore
);

// ==================== SLOW LEARNER DETECTION ====================
router.get("/auto-detect-slow-learners", 
  authorize("superadmin", "school_admin", "admin"), 
  activityController.autoDetectSlowLearners
);

router.post("/auto-create-slow-learner-cases", 
  authorize("superadmin", "school_admin", "admin"), 
  activityController.autoCreateSlowLearnerCases
);

router.post("/update-slow-learner/:activityId", 
  authorize("superadmin", "school_admin", "admin", "teacher", "staff"), 
  async (req, res) => {
    try {
      const activity = await Activity.findById(req.params.activityId);
      if (!activity) {
        return res.status(404).json({ success: false, message: "Activity not found" });
      }
      const result = await activityController.updateSlowLearnerAfterActivity(activity, req.user.schoolId);
      res.json({
        success: true,
        message: result ? "Slow learner updated" : "No active slow learner case found",
        slowLearner: result
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// ==================== LEGACY SUPPORT ====================
router.get("/", 
  authorize("superadmin", "school_admin", "admin", "teacher", "staff"), 
  activityController.getActivities
);

router.post("/", 
  authorize("superadmin", "school_admin", "admin", "teacher", "staff"), 
  activityController.createActivity
);

router.get("/student-performance/:studentId", 
  authorize("superadmin", "school_admin", "admin", "teacher", "staff"), 
  activityController.getStudentPerformanceByCourse
);

router.get("/course-analysis", 
  authorize("superadmin", "school_admin", "admin"), 
  activityController.getCoursePerformanceAnalysis
);

router.get("/performance-report", 
  authorize("superadmin", "school_admin", "admin"), 
  activityController.getPerformanceReport
);

module.exports = router;