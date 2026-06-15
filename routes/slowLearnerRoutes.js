const express = require("express");
const router = express.Router();
const slowLearnerController = require("../controllers/slowLearnerController");
const authMiddleware = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/authMiddleware");

// Apply auth middleware to all routes
router.use(authMiddleware);

// Slow Learner routes - Teachers and admins can manage
router.post("/", authorize("superadmin", "school_admin", "teacher"), slowLearnerController.createCase);
router.get("/", authorize("superadmin", "school_admin", "teacher"), slowLearnerController.getAllCases);
router.get("/by-class", authorize("superadmin", "school_admin"), slowLearnerController.getCasesByClass);
router.post("/:id/progress", authorize("superadmin", "school_admin", "teacher"), slowLearnerController.addProgressNote);
router.put("/:id/status", authorize("superadmin", "school_admin"), slowLearnerController.updateStatus);
router.get("/report", authorize("superadmin", "school_admin"), slowLearnerController.getReport);

module.exports = router;