const express = require("express");
const router = express.Router();
const permissionController = require("../controllers/permissionController");
const authMiddleware = require("../middleware/authMiddleware");
const { authorize, isTeacher, isSchoolAdmin } = require("../middleware/authMiddleware");

// Apply auth middleware to all routes
router.use(authMiddleware);

// ==================== TEACHER ROUTES ====================
// Teachers can request and view their permissions
router.post("/request", isTeacher, permissionController.requestPermission);
router.get("/my-permissions", isTeacher, permissionController.getMyPermissions);

// ==================== SCHOOL ADMIN ROUTES ====================
// School admin can view all permissions and manage them
router.get("/all", isSchoolAdmin, permissionController.getAllPermissions);
router.get("/report", isSchoolAdmin, permissionController.getPermissionReport);
router.put("/:id/approve", isSchoolAdmin, permissionController.approvePermission);
router.put("/:id/disapprove", isSchoolAdmin, permissionController.disapprovePermission);
router.put("/:id/revoke", isSchoolAdmin, permissionController.revokePermission);

module.exports = router;