const express = require("express");
const router = express.Router();
const markController = require("../controllers/markController");
const authMiddleware = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/authMiddleware");

// Apply auth middleware to all routes
router.use(authMiddleware);

// Mark routes - Teachers can manage marks, admins too
router.get("/", authorize("superadmin", "school_admin", "teacher"), markController.getMarks);
router.post("/bulk", authorize("superadmin", "school_admin", "teacher"), markController.bulkUpsertMarks);
router.get("/analytics", authorize("superadmin", "school_admin", "teacher"), markController.getMarksAnalytics);

module.exports = router;