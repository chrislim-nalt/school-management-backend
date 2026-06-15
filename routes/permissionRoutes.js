const express = require("express");
const router = express.Router();
const permissionController = require("../controllers/permissionController");
const authMiddleware = require("../middleware/authMiddleware");

// Apply auth middleware to all routes
router.use(authMiddleware);

// ==================== TEACHER ROUTES ====================
// POST request for permission (must be before /:id routes)
router.post("/request", permissionController.requestPermission);
router.get("/my-permissions", permissionController.getMyPermissions);

// ==================== SCHOOL ADMIN ROUTES ====================
router.get("/all", permissionController.getAllPermissions);
router.get("/report", permissionController.getPermissionReport);

// PUT/DELETE routes with ID parameter (must be after specific routes)
router.put("/:id/approve", permissionController.approvePermission);
router.put("/:id/disapprove", permissionController.disapprovePermission);
router.put("/:id/revoke", permissionController.revokePermission);

module.exports = router;