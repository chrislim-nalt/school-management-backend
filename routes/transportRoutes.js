const express = require("express");
const router = express.Router();
const transportController = require("../controllers/transportController");
const authMiddleware = require("../middleware/authMiddleware");
const { authorize, requireSchoolAccess, isBursar, isSchoolAdmin } = require("../middleware/authMiddleware");

// Apply auth middleware to all routes
router.use(authMiddleware);
router.use(requireSchoolAccess);

// ==================== CLASSES ====================
// Get all classes with student counts
router.get("/classes", authorize("superadmin", "school_admin", "admin", "bursar", "teacher", "staff"), transportController.getSchoolClasses);

// ==================== STUDENT FILTERING ====================
router.get("/students/by-class", authorize("superadmin", "school_admin", "admin", "bursar", "teacher", "staff"), transportController.getStudentsByClass);

// ==================== PAYMENTS ====================
// Only Bursar and Admin can manage payments
router.get("/payments", authorize("superadmin", "school_admin", "admin", "bursar"), transportController.getTransportPayments);
router.post("/payments", authorize("superadmin", "school_admin", "admin", "bursar"), transportController.createTransportPayment);
router.put("/payments/:id", authorize("superadmin", "school_admin", "admin", "bursar"), transportController.updateTransportPayment);
router.delete("/payments/:id", authorize("superadmin", "school_admin", "admin", "bursar"), transportController.deleteTransportPayment);

// ==================== RECORDS ====================
router.get("/records", authorize("superadmin", "school_admin", "admin", "bursar"), transportController.getTransportRecords);
router.post("/records", authorize("superadmin", "school_admin", "admin", "bursar"), transportController.createTransportRecord);
router.delete("/records/:id", authorize("superadmin", "school_admin", "admin", "bursar"), transportController.deleteTransportRecord);

// ==================== REPORTS ====================
router.get("/financial-summary", authorize("superadmin", "school_admin", "admin", "bursar"), transportController.getTransportFinancialSummary);
router.get("/term-payments", authorize("superadmin", "school_admin", "admin", "bursar"), transportController.getTermPaymentsReport);
router.get("/outstanding-payments", authorize("superadmin", "school_admin", "admin", "bursar"), transportController.getOutstandingPayments);

// ==================== STUDENT HISTORY ====================
router.get("/students/:studentId/history", authorize("superadmin", "school_admin", "admin", "bursar"), transportController.getStudentTransportHistory);

module.exports = router;