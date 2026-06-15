const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const authMiddleware = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/roleMiddleware");

// Apply auth middleware to all routes
router.use(authMiddleware);

// ==================== SCHOOL MANAGEMENT ====================
// Super Admin only routes
router.get("/schools", authorize(["superadmin"]), adminController.getSchools);
router.get("/schools/:id", authorize(["superadmin"]), adminController.getSchoolById);
router.post("/schools", authorize(["superadmin"]), adminController.registerSchool);
router.put("/schools/:id/approve", authorize(["superadmin"]), adminController.approveSchool);
router.put("/schools/:id/suspend", authorize(["superadmin"]), adminController.suspendSchool);
router.put("/schools/:id/activate", authorize(["superadmin"]), adminController.activateSchool);
router.delete("/schools/:id", authorize(["superadmin"]), adminController.deleteSchool);
router.put("/schools/:id/subscription", authorize(["superadmin"]), adminController.updateSubscription);

// ==================== USER MANAGEMENT ====================
// Super Admin - access all users
router.get("/users", authorize(["superadmin"]), adminController.getUsers);

// School Admin & Super Admin - access school-specific users
router.get("/schools/:schoolId/users", authorize(["superadmin", "school_admin"]), adminController.getSchoolUsers);

// Create user (both Super Admin and School Admin can create)
router.post("/users", authorize(["superadmin", "school_admin"]), adminController.createUser);

// Update user (both Super Admin and School Admin can update)
router.put("/users/:id", authorize(["superadmin", "school_admin"]), adminController.updateUser);

// Legacy role update endpoint
router.put("/users/:id/role", authorize(["superadmin", "school_admin"]), adminController.updateUserRole);

// Delete user
router.delete("/users/:id", authorize(["superadmin", "school_admin"]), adminController.deleteUser);

// Reset user password
router.post("/users/:userId/reset-password", authorize(["superadmin", "school_admin"]), adminController.resetUserPassword);

// ==================== DASHBOARD STATS ====================
// Super Admin dashboard
router.get("/dashboard/stats", authorize(["superadmin"]), adminController.getDashboardStats);

// School Admin dashboard
router.get("/school-dashboard/stats", authorize(["school_admin"]), adminController.getSchoolAdminStats);

module.exports = router;