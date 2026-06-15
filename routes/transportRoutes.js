const express = require("express");
const router = express.Router();
const transportController = require("../controllers/transportController");
const authMiddleware = require("../middleware/authMiddleware");

// Apply auth middleware to all routes
router.use(authMiddleware);

// ==================== STUDENT FILTERING ====================
router.get("/students/by-class", transportController.getStudentsByClass);

// ==================== PAYMENTS ====================
router.get("/payments", transportController.getTransportPayments);
router.post("/payments", transportController.createTransportPayment);
router.put("/payments/:id", transportController.updateTransportPayment);
router.delete("/payments/:id", transportController.deleteTransportPayment);

// ==================== RECORDS ====================
router.get("/records", transportController.getTransportRecords);
router.post("/records", transportController.createTransportRecord);
router.delete("/records/:id", transportController.deleteTransportRecord);

// ==================== REPORTS ====================
router.get("/financial-summary", transportController.getTransportFinancialSummary);
router.get("/term-payments", transportController.getTermPaymentsReport);
router.get("/outstanding-payments", transportController.getOutstandingPayments);

module.exports = router;