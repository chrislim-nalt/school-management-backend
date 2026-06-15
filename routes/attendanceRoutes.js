const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const attendanceController = require("../controllers/attendanceController");

// Apply auth middleware to all routes
router.use(authMiddleware);

// ==================== STUDENT ATTENDANCE ====================
// Get students by class (for teachers to select class first)
router.get("/students/by-class", attendanceController.getStudentsByClass);

// Mark student attendance for a specific class
router.post("/students/mark", attendanceController.markStudentAttendance);

// Get student attendance by class and date
router.get("/students/class", attendanceController.getStudentAttendanceByClass);

// Get student attendance report
router.get("/students/report", attendanceController.getStudentAttendanceReport);

// ==================== TEACHER ATTENDANCE ====================
// Get all teachers for attendance marking
router.get("/teachers/list", attendanceController.getTeachersForAttendance);

// Mark teacher attendance
router.post("/teachers/mark", attendanceController.markTeacherAttendance);

// Get teacher attendance by date
router.get("/teachers/date", attendanceController.getTeacherAttendanceByDate);

// Get teacher attendance report
router.get("/teachers/report", attendanceController.getTeacherAttendanceReport);

module.exports = router;