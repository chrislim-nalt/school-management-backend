// routes/feeRoutes.js
const express = require("express");
const router = express.Router();
const feeController = require("../controllers/feeController");
const authMiddleware = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/authMiddleware");

// Apply auth middleware
router.use(authMiddleware);

// ==================== FEE ROUTES ====================
router.post("/", 
  authorize("superadmin", "school_admin", "admin", "bursar"), 
  feeController.recordFee
);

router.get("/", 
  authorize("superadmin", "school_admin", "admin", "bursar", "teacher"), 
  feeController.getFeeRecords
);

router.get("/outstanding", 
  authorize("superadmin", "school_admin", "admin", "bursar"), 
  feeController.getOutstandingFees
);

router.get("/student/:studentId", 
  authorize("superadmin", "school_admin", "admin", "bursar", "teacher"), 
  feeController.getStudentFeeSummary
);

module.exports = router;