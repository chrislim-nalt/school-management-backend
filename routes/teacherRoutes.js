const express = require("express");
const router = express.Router();
const teacherController = require("../controllers/teacherController");
const authMiddleware = require("../middleware/authMiddleware");
const { authorize, isSchoolAdmin, isBursar } = require("../middleware/authMiddleware");

// Apply auth middleware to all routes
router.use(authMiddleware);

// ==================== TEACHER MANAGEMENT ====================
// Only Super Admin and School Admin can manage teachers
router.get("/", authorize("superadmin", "school_admin", "admin"), teacherController.getTeachers);
router.get("/:id", authorize("superadmin", "school_admin", "admin"), teacherController.getTeacherById);
router.post("/", authorize("superadmin", "school_admin", "admin"), teacherController.createTeacher);
router.put("/:id", authorize("superadmin", "school_admin", "admin"), teacherController.updateTeacher);
router.delete("/:id", authorize("superadmin", "school_admin", "admin"), teacherController.deleteTeacher);
router.get("/attendance/stats", authorize("superadmin", "school_admin", "admin"), teacherController.getTeacherAttendanceStats);

// ==================== STUDENT FILTERING ====================
// Teachers, Bursar, and Admin can access
router.get("/students/by-class", authorize("superadmin", "school_admin", "admin", "bursar", "teacher"), teacherController.getStudentsByClass);
router.get("/classes", authorize("superadmin", "school_admin", "admin", "bursar", "teacher"), teacherController.getSchoolClasses);

// ==================== TRANSPORT PAYMENTS ====================
// Only Bursar and Admin can manage payments
router.get("/transport/payments", authorize("superadmin", "school_admin", "admin", "bursar"), teacherController.getTransportPayments);
router.post("/transport/payments", authorize("superadmin", "school_admin", "admin", "bursar"), teacherController.createTransportPayment);
router.put("/transport/payments/:id", authorize("superadmin", "school_admin", "admin", "bursar"), teacherController.updateTransportPayment);
router.delete("/transport/payments/:id", authorize("superadmin", "school_admin", "admin", "bursar"), teacherController.deleteTransportPayment);

// ==================== TRANSPORT RECORDS ====================
router.get("/transport/records", authorize("superadmin", "school_admin", "admin", "bursar"), teacherController.getTransportRecords);
router.post("/transport/records", authorize("superadmin", "school_admin", "admin", "bursar"), teacherController.createTransportRecord);
router.delete("/transport/records/:id", authorize("superadmin", "school_admin", "admin", "bursar"), teacherController.deleteTransportRecord);

// ==================== FINANCIAL REPORTS ====================
router.get("/transport/financial-summary", authorize("superadmin", "school_admin", "admin", "bursar"), teacherController.getTransportFinancialSummary);
router.get("/transport/term-payments", authorize("superadmin", "school_admin", "admin", "bursar"), teacherController.getTermPaymentsReport);
router.get("/transport/outstanding-payments", authorize("superadmin", "school_admin", "admin", "bursar"), teacherController.getOutstandingPayments);

// ==================== STUDENT HISTORY ====================
router.get("/transport/students/:studentId/history", authorize("superadmin", "school_admin", "admin", "bursar"), teacherController.getStudentTransportHistory);

module.exports = router;