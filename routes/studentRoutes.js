const express = require("express");
const router = express.Router();
const studentController = require("../controllers/studentController");
const authMiddleware = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/authMiddleware");

// Apply auth middleware to all routes
router.use(authMiddleware);

// Student routes - Teachers can view, only admins can modify
router.get("/", authorize("superadmin", "school_admin", "teacher"), studentController.getStudents);
router.get("/:id", authorize("superadmin", "school_admin", "teacher"), studentController.getStudentById);
router.post("/", authorize("superadmin", "school_admin"), studentController.createStudent);
router.put("/:id", authorize("superadmin", "school_admin"), studentController.updateStudent);
router.delete("/:id", authorize("superadmin", "school_admin"), studentController.deleteStudent);
router.get("/:id/performance", authorize("superadmin", "school_admin", "teacher"), studentController.getStudentPerformance);
router.get("/:id/attendance", authorize("superadmin", "school_admin", "teacher"), studentController.getStudentAttendance);

module.exports = router;