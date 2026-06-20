const express = require("express");
const router = express.Router();
const courseController = require("../controllers/courseController");
const authMiddleware = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/authMiddleware");

// Apply auth middleware to all routes
router.use(authMiddleware);

// Course routes - School admins and teachers can access
router.get("/", authorize("superadmin", "school_admin", "admin", "teacher", "staff"), courseController.getCourses);
router.get("/:id", authorize("superadmin", "school_admin", "admin", "teacher", "staff"), courseController.getCourseById);
router.get("/grade/:grade", authorize("superadmin", "school_admin", "admin", "teacher", "staff"), courseController.getCoursesByGrade);

// Management routes - Only admins can create/update/delete
router.post("/", authorize("superadmin", "school_admin", "admin"), courseController.createCourse);
router.put("/:id", authorize("superadmin", "school_admin", "admin"), courseController.updateCourse);
router.delete("/:id", authorize("superadmin", "school_admin", "admin"), courseController.deleteCourse);

module.exports = router;