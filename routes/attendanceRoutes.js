const express = require("express");
const router = express.Router();
const attendanceController = require("../controllers/attendanceController");
const authMiddleware = require("../middleware/authMiddleware");
const { authorize, isTeacher, isSchoolAdmin } = require("../middleware/authMiddleware");

// Apply auth middleware to all routes
router.use(authMiddleware);

// ==================== STUDENT ATTENDANCE ====================
// Get students by class for attendance - Teachers, Admin, Staff can access
router.get("/students/by-class", authorize("superadmin", "school_admin", "admin", "teacher", "staff"), attendanceController.getStudentsByClassForAttendance);

// Mark student attendance
router.post("/students/mark", authorize("superadmin", "school_admin", "admin", "teacher", "staff"), attendanceController.markStudentAttendance);

// Get student attendance by class
router.get("/students/class", authorize("superadmin", "school_admin", "admin", "teacher", "staff"), attendanceController.getStudentAttendanceByClass);

// Get student attendance report
router.get("/students/report", authorize("superadmin", "school_admin", "admin", "teacher", "staff"), attendanceController.getStudentAttendanceReport);

// ==================== TEACHER ATTENDANCE ====================
// Get teachers for attendance - Admin and Customer Care
router.get("/teachers/list", authorize("superadmin", "school_admin", "admin", "customer_care"), attendanceController.getTeachersForAttendance);

// Mark teacher attendance
router.post("/teachers/mark", authorize("superadmin", "school_admin", "admin", "customer_care"), attendanceController.markTeacherAttendance);

// Get teacher attendance by date
router.get("/teachers/date", authorize("superadmin", "school_admin", "admin", "customer_care"), attendanceController.getTeacherAttendanceByDate);

// Get teacher attendance report
router.get("/teachers/report", authorize("superadmin", "school_admin", "admin", "customer_care"), attendanceController.getTeacherAttendanceReport);

// ==================== LEGACY ROUTES ====================
// Legacy: Mark attendance (will be redirected)
router.post("/mark", authorize("superadmin", "school_admin", "admin", "teacher", "staff", "customer_care"), async (req, res) => {
  // Check if it's student or teacher attendance
  if (req.body.userType === "STUDENT" || req.body.grade) {
    return attendanceController.markStudentAttendance(req, res);
  } else {
    return attendanceController.markTeacherAttendance(req, res);
  }
});

// Legacy: Get attendance report
router.get("/report", authorize("superadmin", "school_admin", "admin", "teacher", "staff", "customer_care"), async (req, res) => {
  if (req.query.userType === "STUDENT") {
    return attendanceController.getStudentAttendanceReport(req, res);
  } else if (req.query.userType === "TEACHER") {
    return attendanceController.getTeacherAttendanceReport(req, res);
  }
  return res.status(400).json({ success: false, message: "Invalid user type" });
});

module.exports = router;