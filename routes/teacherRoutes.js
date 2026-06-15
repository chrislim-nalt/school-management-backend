const express = require("express");
const router = express.Router();
const teacherController = require("../controllers/teacherController");
const authMiddleware = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/authMiddleware");

// Apply auth middleware to all routes
router.use(authMiddleware);

// Teacher routes with role-based access
// Only Super Admin and School Admin can manage teachers
router.get("/", authorize("superadmin", "school_admin"), teacherController.getTeachers);
router.get("/:id", authorize("superadmin", "school_admin"), teacherController.getTeacherById);
router.post("/", authorize("superadmin", "school_admin"), teacherController.createTeacher);
router.put("/:id", authorize("superadmin", "school_admin"), teacherController.updateTeacher);
router.delete("/:id", authorize("superadmin", "school_admin"), teacherController.deleteTeacher);
router.get("/attendance/stats", authorize("superadmin", "school_admin"), teacherController.getTeacherAttendanceStats);

module.exports = router;