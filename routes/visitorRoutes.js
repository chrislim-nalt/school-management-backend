const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  createVisitor,
  checkoutVisitor,
  getVisitors,
  getVisitorById,
  updateVisitor,
  deleteVisitor,
  getVisitorStatistics,
  getVisitorReport
} = require("../controllers/visitorController");

// Apply authentication to all routes
router.use(authMiddleware);

// Customer Care and Admin routes
router.post("/", createVisitor);
router.get("/", getVisitors);
router.get("/:id", getVisitorById);
router.put("/:id/checkout", checkoutVisitor);
router.put("/:id", updateVisitor);

// Admin only routes
router.delete("/:id", deleteVisitor);
router.get("/statistics", getVisitorStatistics);
router.get("/report", getVisitorReport);

module.exports = router;