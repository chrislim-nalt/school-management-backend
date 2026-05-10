const User = require("../models/User");
const School = require("../models/School");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

// Helper functions
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// ==================== LOGIN FUNCTIONS ====================

exports.login = async (req, res) => {
    try {
        const { email, password, schoolCode } = req.body;
        
        const school = await School.findOne({ schoolCode: schoolCode.toUpperCase() });
        if (!school) return res.status(404).json({ message: "School not found" });
        
        const user = await User.findOne({ email, school: school._id });
        if (!user) return res.status(401).json({ message: "Invalid credentials" });
        
        if (!user.isActive) return res.status(403).json({ message: "Account deactivated" });
        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });
        
        user.lastLogin = new Date();
        await user.save();
        
        const token = jwt.sign(
            { id: user._id, email: user.email, name: user.name, role: user.role, schoolId: school._id, schoolCode: school.schoolCode, schoolName: school.name },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );
        
        res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role, school: { id: school._id, name: school.name, code: school.schoolCode } } });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const user = await User.findOne({ email, role: "superadmin" });
        if (!user) return res.status(401).json({ message: "Invalid credentials" });
        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });
        
        const token = jwt.sign(
            { id: user._id, email: user.email, name: user.name, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );
        
        res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ==================== SUPER ADMIN SETUP (ONE-TIME) ====================

exports.setupSuperAdmin = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        // Check if super admin already exists
        const existing = await User.findOne({ role: "superadmin" });
        if (existing) {
            return res.status(400).json({ message: "Super admin already exists. Setup disabled." });
        }
        
        // Validate input
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters" });
        }
        
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // Create super admin
        const user = new User({
            name: name || "Super Administrator",
            email: email,
            password: hashedPassword,
            role: "superadmin",
            isActive: true,
        });
        
        await user.save();
        
        console.log("✅ Super admin created:", email);
        
        res.status(201).json({ 
            success: true,
            message: "Super admin created successfully!",
            user: { email: user.email, role: user.role }
        });
    } catch (error) {
        console.error("Setup error:", error);
        res.status(500).json({ message: error.message });
    }
};

// ==================== PROFILE FUNCTIONS ====================

exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password -resetOtp -resetOtpExpires").populate("school", "name schoolCode");
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const { name, email, phone } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });
        
        if (email && email !== user.email) {
            const existing = await User.findOne({ email, school: user.school, _id: { $ne: user._id } });
            if (existing) return res.status(400).json({ message: "Email already in use" });
            user.email = email;
        }
        if (name) user.name = name;
        if (phone) user.phone = phone;
        await user.save();
        
        res.json({ message: "Profile updated", user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role } });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.setupSecurity = async (req, res) => {
    try {
        const { securityQuestion, securityAnswer } = req.body;
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });
        
        user.securityQuestion = securityQuestion;
        user.securityAnswer = securityAnswer.toLowerCase().trim();
        await user.save();
        
        res.json({ message: "Security questions saved successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) return res.status(400).json({ message: "All fields required" });
        if (newPassword.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
        
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });
        
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(401).json({ message: "Current password incorrect" });
        
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();
        
        res.json({ message: "Password changed successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// ==================== FORGOT SCHOOL CODE - SELF RECOVERY ====================

exports.requestSchoolCodeRecovery = async (req, res) => {
    try {
        const { email, phone } = req.body;
        
        let user;
        if (email) {
            user = await User.findOne({ email }).populate("school");
        } else if (phone) {
            user = await User.findOne({ phone }).populate("school");
        }
        
        if (!user || !user.school) return res.status(404).json({ message: "No account found" });
        
        const recoveryToken = generateOTP();
        user.resetOtp = recoveryToken;
        user.resetOtpExpires = new Date(Date.now() + 10 * 60000);
        await user.save();
        
        console.log("\n" + "=".repeat(60));
        console.log(`🏫 SCHOOL CODE RECOVERY REQUEST`);
        console.log("=".repeat(60));
        console.log(`User: ${user.name}`);
        console.log(`Email: ${user.email}`);
        console.log(`School: ${user.school.name}`);
        console.log(`School Code: ${user.school.schoolCode}`);
        console.log(`Verification Token: ${recoveryToken}`);
        console.log("=".repeat(60) + "\n");
        
        const hasSecurity = user.securityQuestion && user.securityAnswer;
        
        res.json({ 
            message: hasSecurity ? "Verification code generated. Check server console." : "Please contact your school administrator.",
            requiresSecurityQuestion: hasSecurity,
            recoveryToken: recoveryToken
        });
    } catch (error) {
        console.error("Request recovery error:", error);
        res.status(500).json({ message: error.message });
    }
};

exports.verifySecurityAnswer = async (req, res) => {
    try {
        const { email, answer, recoveryToken } = req.body;
        
        const user = await User.findOne({ email }).populate("school");
        if (!user) return res.status(404).json({ message: "User not found" });
        
        if (!user.resetOtp || user.resetOtp !== recoveryToken) {
            return res.status(401).json({ message: "Invalid or expired recovery token" });
        }
        
        if (new Date() > user.resetOtpExpires) {
            return res.status(401).json({ message: "Recovery token expired" });
        }
        
        if (user.securityAnswer !== answer.toLowerCase().trim()) {
            return res.status(401).json({ message: "Incorrect security answer" });
        }
        
        user.resetOtp = null;
        user.resetOtpExpires = null;
        await user.save();
        
        res.json({ 
            message: "Identity verified successfully",
            schoolCode: user.school.schoolCode,
            schoolName: user.school.name
        });
    } catch (error) {
        console.error("Verify security error:", error);
        res.status(500).json({ message: error.message });
    }
};

// ==================== FORGOT PASSWORD - SELF RESET ====================

exports.requestPasswordReset = async (req, res) => {
    try {
        const { email } = req.body;
        
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "No account found" });
        
        if (!user.securityQuestion || !user.securityAnswer) {
            return res.status(400).json({ 
                message: "Security questions not set. Please contact your school administrator.",
                needsSecuritySetup: true
            });
        }
        
        const resetToken = generateOTP();
        user.resetOtp = resetToken;
        user.resetOtpExpires = new Date(Date.now() + 10 * 60000);
        await user.save();
        
        console.log("\n" + "=".repeat(60));
        console.log(`🔐 PASSWORD RESET REQUEST`);
        console.log("=".repeat(60));
        console.log(`User: ${user.name}`);
        console.log(`Email: ${user.email}`);
        console.log(`Security Question: ${user.securityQuestion}`);
        console.log(`Reset Token: ${resetToken}`);
        console.log("=".repeat(60) + "\n");
        
        res.json({ 
            message: "Reset token generated. Check server console.",
            securityQuestion: user.securityQuestion,
            resetToken: resetToken
        });
    } catch (error) {
        console.error("Request reset error:", error);
        res.status(500).json({ message: error.message });
    }
};

exports.verifyAndResetPassword = async (req, res) => {
    try {
        const { email, answer, resetToken, newPassword } = req.body;
        
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters" });
        }
        
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });
        
        if (!user.resetOtp || user.resetOtp !== resetToken) {
            return res.status(401).json({ message: "Invalid or expired reset token" });
        }
        
        if (new Date() > user.resetOtpExpires) {
            return res.status(401).json({ message: "Reset token expired" });
        }
        
        if (user.securityAnswer !== answer.toLowerCase().trim()) {
            return res.status(401).json({ message: "Incorrect security answer" });
        }
        
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.resetOtp = null;
        user.resetOtpExpires = null;
        await user.save();
        
        console.log(`\n✅ Password reset successfully for ${email}\n`);
        
        res.json({ message: "Password reset successfully! Please login with your new password." });
    } catch (error) {
        console.error("Reset password error:", error);
        res.status(500).json({ message: error.message });
    }
};

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "No account found" });
        
        if (!user.securityQuestion || !user.securityAnswer) {
            return res.status(400).json({ 
                message: "Security questions not set. Please login and set up security questions first."
            });
        }
        
        const otp = generateOTP();
        user.resetOtp = otp;
        user.resetOtpExpires = new Date(Date.now() + 10 * 60000);
        await user.save();
        
        console.log("\n" + "=".repeat(50));
        console.log(`🔐 PASSWORD RESET OTP for ${email}`);
        console.log(`OTP: ${otp}`);
        console.log(`Security Question: ${user.securityQuestion}`);
        console.log("=".repeat(50) + "\n");
        
        res.json({ 
            message: "Password reset code generated. Check server console.",
            securityQuestion: user.securityQuestion,
            email: email 
        });
    } catch (error) {
        console.error("Forgot password error:", error);
        res.status(500).json({ message: error.message });
    }
};

exports.verifyResetOtp = async (req, res) => {
    try {
        const { email, otp, securityAnswer } = req.body;
        
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });
        
        if (!user.resetOtp || user.resetOtp !== otp) {
            return res.status(401).json({ message: "Invalid verification code" });
        }
        
        if (new Date() > user.resetOtpExpires) {
            return res.status(401).json({ message: "Code expired" });
        }
        
        if (user.securityAnswer !== securityAnswer?.toLowerCase().trim()) {
            return res.status(401).json({ message: "Incorrect security answer" });
        }
        
        res.json({ message: "Code verified successfully", verified: true });
    } catch (error) {
        console.error("Verify reset OTP error:", error);
        res.status(500).json({ message: error.message });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { email, otp, securityAnswer, newPassword } = req.body;
        
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters" });
        }
        
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });
        
        if (!user.resetOtp || user.resetOtp !== otp) {
            return res.status(401).json({ message: "Invalid verification code" });
        }
        
        if (new Date() > user.resetOtpExpires) {
            return res.status(401).json({ message: "Code expired" });
        }
        
        if (user.securityAnswer !== securityAnswer?.toLowerCase().trim()) {
            return res.status(401).json({ message: "Incorrect security answer" });
        }
        
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.resetOtp = null;
        user.resetOtpExpires = null;
        await user.save();
        
        res.json({ message: "Password reset successfully! Please login with your new password." });
    } catch (error) {
        console.error("Reset password error:", error);
        res.status(500).json({ message: error.message });
    }
};

exports.forgotSchoolCode = async (req, res) => {
    try {
        const { email, securityAnswer } = req.body;
        
        const user = await User.findOne({ email }).populate("school");
        if (!user || !user.school) return res.status(404).json({ message: "No account found" });
        
        if (!user.securityQuestion || !user.securityAnswer) {
            return res.status(400).json({ message: "Security questions not set" });
        }
        
        if (user.securityAnswer !== securityAnswer?.toLowerCase().trim()) {
            return res.status(401).json({ message: "Incorrect security answer" });
        }
        
        console.log("\n" + "=".repeat(50));
        console.log(`🏫 SCHOOL CODE RECOVERED for ${email}`);
        console.log(`School: ${user.school.name}`);
        console.log(`School Code: ${user.school.schoolCode}`);
        console.log("=".repeat(50) + "\n");
        
        res.json({ 
            message: "School code retrieved successfully",
            schoolCode: user.school.schoolCode,
            schoolName: user.school.name
        });
    } catch (error) {
        console.error("Forgot school code error:", error);
        res.status(500).json({ message: error.message });
    }
};