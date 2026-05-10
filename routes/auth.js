const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const { 
    login, 
    adminLogin, 
    setupSuperAdmin,
    getProfile, 
    updateProfile, 
    changePassword,
    setupSecurity,
    forgotPassword,
    verifyResetOtp,
    resetPassword,
    forgotSchoolCode,
    requestSchoolCodeRecovery,
    verifySecurityAnswer,
    requestPasswordReset,
    verifyAndResetPassword
} = require("../controllers/authController");

// Public routes
router.post("/login", login);
router.post("/admin-login", adminLogin);
router.post("/setup-superadmin", setupSuperAdmin);

// Password reset (with security questions)
router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-otp", verifyResetOtp);
router.post("/reset-password", resetPassword);

// School code recovery (with security questions)
router.post("/forgot-school-code", forgotSchoolCode);

// Self-recovery endpoints
router.post("/request-school-code-recovery", requestSchoolCodeRecovery);
router.post("/verify-security-answer", verifySecurityAnswer);
router.post("/request-password-reset", requestPasswordReset);
router.post("/verify-and-reset-password", verifyAndResetPassword);

// Protected routes
router.get("/profile", auth, getProfile);
router.put("/profile", auth, updateProfile);
router.put("/change-password", auth, changePassword);
router.post("/setup-security", auth, setupSecurity);

module.exports = router;