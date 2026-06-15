const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");
const authMiddleware = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/authMiddleware");

// Apply auth middleware to all routes
router.use(authMiddleware);

// Report routes - Only admins can view reports
router.get("/daily", authorize("superadmin", "school_admin"), reportController.getDailyReport);
router.get("/weekly", authorize("superadmin", "school_admin"), reportController.getWeeklyReport);
router.get("/monthly", authorize("superadmin", "school_admin"), reportController.getMonthlyReport);
router.get("/yearly", authorize("superadmin", "school_admin"), reportController.getYearlyReport);

module.exports = router;