const express = require("express");
const router = express.Router();
const courseController = require("../controllers/courseController");
const authMiddleware = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/authMiddleware");

// Apply auth middleware to all routes
router.use(authMiddleware);

// Course routes - Teachers can view, only admins can modify
router.get("/", authorize("superadmin", "school_admin", "teacher"), courseController.getCourses);
router.get("/:id", authorize("superadmin", "school_admin", "teacher"), courseController.getCourseById);
router.post("/", authorize("superadmin", "school_admin"), courseController.createCourse);
router.put("/:id", authorize("superadmin", "school_admin"), courseController.updateCourse);
router.delete("/:id", authorize("superadmin", "school_admin"), courseController.deleteCourse);
router.get("/grade/:grade", authorize("superadmin", "school_admin", "teacher"), courseController.getCoursesByGrade);

module.exports = router;