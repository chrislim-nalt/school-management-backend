const User = require("../models/User");
const School = require("../models/School");
const Subscription = require("../models/Subscription");
const bcrypt = require("bcryptjs");

// Helper function to generate strong password
function generateStrongPassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

// Helper function to get default permissions based on userType
function getDefaultPermissions(userType) {
    const defaults = {
        teacher: {
            canManageAttendance: true,
            canManageMarks: true,
            canManageDiscipline: true,
            canManageHomework: true,
            canViewEnglishPerformance: true,
            canViewSlowLearners: false,
            canManageActivities: true
        },
        school_admin: {
            canManageAttendance: true,
            canManageMarks: true,
            canManageDiscipline: true,
            canManageHomework: true,
            canViewEnglishPerformance: true,
            canViewSlowLearners: true,
            canManageActivities: true
        },
        bursar: {
            canManageAttendance: false,
            canManageMarks: false,
            canManageDiscipline: false,
            canManageHomework: false,
            canViewEnglishPerformance: false,
            canViewSlowLearners: false,
            canManageActivities: false
        },
        stock_keeper: {
            canManageAttendance: false,
            canManageMarks: false,
            canManageDiscipline: false,
            canManageHomework: false,
            canViewEnglishPerformance: false,
            canViewSlowLearners: false,
            canManageActivities: false
        },
        customer_care: {
            canManageAttendance: true,
            canManageMarks: false,
            canManageDiscipline: false,
            canManageHomework: false,
            canViewEnglishPerformance: false,
            canViewSlowLearners: false,
            canManageActivities: false
        },
        default: {
            canManageAttendance: false,
            canManageMarks: false,
            canManageDiscipline: false,
            canManageHomework: false,
            canViewEnglishPerformance: false,
            canViewSlowLearners: false,
            canManageActivities: false
        }
    };
    return defaults[userType] || defaults.default;
}

// Helper function to generate credential display text
function generateCredentialDisplay(school, user, password, userTypeDisplay) {
    const border = "═".repeat(64);
    return `
┌${border}┐
│                    NEW USER CREDENTIALS                      │
├${border}┤
│  School Name:    ${(school.name || "N/A").padEnd(40)}│
│  School Code:    ${(school.schoolCode || "N/A").padEnd(40)}│
│  Login URL:      ${(process.env.FRONTEND_URL || "http://localhost:5173").padEnd(40)}│
│                                                              │
│  User Details:                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Name:        ${(user.name || "N/A").padEnd(43)}││
│  │ Email:       ${(user.email || "N/A").padEnd(43)}││
│  │ Password:    ${(password || "N/A").padEnd(43)}││
│  │ Role:        ${(user.role || "staff").padEnd(15)} (${(userTypeDisplay || "Staff").padEnd(20)})││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ⚠️  Please save these credentials securely.                │
│  ⚠️  Share this information with the user.                  │
└${border}┘
    `;
}

// ==================== SCHOOL MANAGEMENT ====================

// Get all schools (with filters)
exports.getSchools = async (req, res) => {
    try {
        const { status, search } = req.query;
        let filter = {};
        if (status && status !== "all") filter.status = status;
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { schoolCode: { $regex: search, $options: 'i' } }
            ];
        }
        const schools = await School.find(filter).sort({ createdAt: -1 });
        
        const schoolsWithSubscriptions = await Promise.all(schools.map(async (school) => {
            const subscription = await Subscription.findOne({ school: school._id });
            const userCount = await User.countDocuments({ school: school._id });
            return { 
                ...school.toObject(), 
                subscription,
                stats: { userCount }
            };
        }));
        
        res.json(schoolsWithSubscriptions);
    } catch (error) {
        console.error("Get schools error:", error);
        res.status(500).json({ message: error.message });
    }
};

// Get single school with full details
exports.getSchoolById = async (req, res) => {
    try {
        const school = await School.findById(req.params.id);
        if (!school) return res.status(404).json({ message: "School not found" });
        
        const subscription = await Subscription.findOne({ school: school._id });
        const users = await User.find({ school: school._id }).select("-password");
        
        const activeUsers = await User.countDocuments({ school: school._id, isActive: true });
        const inactiveUsers = await User.countDocuments({ school: school._id, isActive: false });
        
        res.json({ 
            school, 
            subscription, 
            users,
            stats: {
                totalUsers: users.length,
                activeUsers,
                inactiveUsers
            }
        });
    } catch (error) {
        console.error("Get school error:", error);
        res.status(500).json({ message: error.message });
    }
};

// Register new school (Super Admin only)
exports.registerSchool = async (req, res) => {
    try {
        const { 
            name, email, phone, address, 
            adminName, adminEmail, adminPassword, 
            plan, adminUserType 
        } = req.body;
        
        console.log("Registering school:", name);
        
        // Validation
        if (!name || !email || !adminName || !adminEmail) {
            return res.status(400).json({ message: "Missing required fields" });
        }
        
        // Check if school already exists
        const existingSchool = await School.findOne({ $or: [{ name }, { email }] });
        if (existingSchool) {
            return res.status(400).json({ message: "School already exists" });
        }
        
        // Check if admin email already used
        const existingAdmin = await User.findOne({ email: adminEmail.toLowerCase() });
        if (existingAdmin) {
            return res.status(400).json({ message: "Admin email already registered" });
        }
        
        // Create school
        const school = new School({ 
            name, 
            email, 
            phone: phone || "", 
            address: address || "", 
            status: "active",
            registeredBy: req.user ? req.user.id : null
        });
        await school.save();
        
        console.log("School created - Code:", school.schoolCode);
        
        // Create admin user
        const finalPassword = adminPassword || generateStrongPassword();
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(finalPassword, salt);
        
        const finalAdminUserType = adminUserType || "school_admin";
        
        const user = new User({
            name: adminName,
            email: adminEmail.toLowerCase(),
            password: hashedPassword,
            school: school._id,
            role: "admin",
            userType: finalAdminUserType,
            isActive: true,
            createdBy: req.user ? req.user.id : null,
            createdByName: req.user ? req.user.name : "System",
            permissions: getDefaultPermissions(finalAdminUserType)
        });
        await user.save();
        
        // Create subscription
        let endDate = null;
        if (plan === "monthly") {
            endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        } else if (plan === "yearly") {
            endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        } else if (plan === "free_trial") {
            endDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
        }
        
        const subscription = new Subscription({
            school: school._id,
            plan: plan || "free_trial",
            status: "active",
            startDate: new Date(),
            endDate: endDate
        });
        await subscription.save();
        
        // Prepare credentials for display
        const credentials = {
            schoolName: school.name,
            schoolCode: school.schoolCode,
            adminName: adminName,
            adminEmail: adminEmail,
            adminPassword: finalPassword,
            adminUserType: finalAdminUserType,
            loginUrl: process.env.FRONTEND_URL || "http://localhost:5173"
        };
        
        const displayText = `
╔══════════════════════════════════════════════════════════════════════════════╗
║                         SCHOOL REGISTRATION SUCCESSFUL                       ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  School Name:    ${school.name}
║  School Code:    ${school.schoolCode}
║  Login URL:      ${process.env.FRONTEND_URL || "http://localhost:5173"}
║
║  Administrator Details:
║  ┌────────────────────────────────────────────────────────────────────────┐
║  │ Name:        ${adminName}
║  │ Email:       ${adminEmail}
║  │ Password:    ${finalPassword}
║  │ Role:        Admin (${finalAdminUserType})
║  └────────────────────────────────────────────────────────────────────────┘
║
║  ⚠️  IMPORTANT: Save these credentials. Share with the school administrator.
╚══════════════════════════════════════════════════════════════════════════════╝
        `;
        
        console.log(displayText);
        
        res.status(201).json({
            success: true,
            message: "School registered successfully!",
            credentials: credentials,
            displayText: displayText,
            school: { 
                id: school._id, 
                name: school.name, 
                code: school.schoolCode,
                status: school.status
            },
            user: { 
                id: user._id,
                name: user.name,
                email: adminEmail, 
                password: finalPassword,
                userType: user.userType
            }
        });
        
    } catch (error) {
        console.error("Register school error:", error);
        res.status(500).json({ message: error.message });
    }
};

// Approve school (activate)
exports.approveSchool = async (req, res) => {
    try {
        const school = await School.findById(req.params.id);
        if (!school) return res.status(404).json({ message: "School not found" });
        
        school.status = "active";
        if (req.user) {
            school.approvedBy = req.user.id;
            school.approvedAt = new Date();
        }
        await school.save();
        
        await User.updateMany({ school: school._id }, { isActive: true });
        
        res.json({ 
            success: true,
            message: "School approved successfully", 
            school 
        });
    } catch (error) {
        console.error("Approve school error:", error);
        res.status(500).json({ message: error.message });
    }
};

// Suspend school (deactivate all users)
exports.suspendSchool = async (req, res) => {
    try {
        const school = await School.findById(req.params.id);
        if (!school) return res.status(404).json({ message: "School not found" });
        
        school.status = "suspended";
        await school.save();
        
        const deactivateResult = await User.updateMany(
            { school: school._id }, 
            { isActive: false }
        );
        
        console.log(`School ${school.name} suspended. ${deactivateResult.modifiedCount} users deactivated.`);
        
        res.json({ 
            success: true,
            message: `School suspended successfully. ${deactivateResult.modifiedCount} users deactivated.`,
            school,
            usersAffected: deactivateResult.modifiedCount
        });
    } catch (error) {
        console.error("Suspend school error:", error);
        res.status(500).json({ message: error.message });
    }
};

// Activate suspended school
exports.activateSchool = async (req, res) => {
    try {
        const school = await School.findById(req.params.id);
        if (!school) return res.status(404).json({ message: "School not found" });
        
        if (school.status !== "suspended") {
            return res.status(400).json({ message: "School is not suspended" });
        }
        
        school.status = "active";
        await school.save();
        
        await User.updateMany({ school: school._id }, { isActive: true });
        
        res.json({ 
            success: true,
            message: "School activated successfully. All users reactivated.", 
            school 
        });
    } catch (error) {
        console.error("Activate school error:", error);
        res.status(500).json({ message: error.message });
    }
};

// Delete school (permanent)
exports.deleteSchool = async (req, res) => {
    try {
        const school = await School.findById(req.params.id);
        if (!school) return res.status(404).json({ message: "School not found" });
        
        const schoolName = school.name;
        const userCount = await User.countDocuments({ school: req.params.id });
        
        await User.deleteMany({ school: req.params.id });
        await Subscription.deleteOne({ school: req.params.id });
        await School.deleteOne({ _id: req.params.id });
        
        console.log(`School ${schoolName} deleted. ${userCount} users removed.`);
        
        res.json({ 
            success: true,
            message: `School "${schoolName}" deleted permanently. ${userCount} users removed.`,
            deletedSchool: schoolName,
            usersRemoved: userCount
        });
    } catch (error) {
        console.error("Delete school error:", error);
        res.status(500).json({ message: error.message });
    }
};

// Update subscription
exports.updateSubscription = async (req, res) => {
    try {
        let subscription = await Subscription.findOne({ school: req.params.id });
        if (!subscription) {
            subscription = new Subscription({ school: req.params.id });
        }
        
        subscription.plan = req.body.plan;
        subscription.status = "active";
        
        if (req.body.plan === "lifetime") {
            subscription.endDate = null;
        } else if (req.body.plan === "monthly") {
            subscription.endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        } else if (req.body.plan === "yearly") {
            subscription.endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
        } else {
            subscription.endDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
        }
        
        await subscription.save();
        
        const school = await School.findById(req.params.id);
        if (school && school.status === "suspended" && req.body.plan !== "free_trial") {
            school.status = "active";
            await school.save();
            await User.updateMany({ school: school._id }, { isActive: true });
        }
        
        res.json({ 
            success: true,
            message: "Subscription updated", 
            subscription 
        });
    } catch (error) {
        console.error("Update subscription error:", error);
        res.status(500).json({ message: error.message });
    }
};

// ==================== USER MANAGEMENT ====================

// Get all users (Super Admin - all schools)
exports.getUsers = async (req, res) => {
    try {
        const { schoolId, userType, isActive, search } = req.query;
        let filter = {};
        
        if (schoolId) filter.school = schoolId;
        if (userType) filter.userType = userType;
        if (isActive !== undefined) filter.isActive = isActive === "true";
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }
        
        const users = await User.find(filter)
            .select("-password -resetOtp -resetOtpExpires")
            .populate("school", "name schoolCode status")
            .populate("createdBy", "name email")
            .sort({ createdAt: -1 });
        
        res.json(users);
    } catch (error) {
        console.error("Get users error:", error);
        res.status(500).json({ message: error.message });
    }
};

// Get users by school (School Admin)
exports.getSchoolUsers = async (req, res) => {
    try {
        const { schoolId } = req.params;
        
        // Security: Ensure user has access to this school
        if (req.user.role !== "superadmin" && req.user.schoolId && req.user.schoolId.toString() !== schoolId) {
            return res.status(403).json({ message: "Access denied to this school's users" });
        }
        
        const { userType, isActive, search } = req.query;
        let filter = { school: schoolId };
        
        if (userType) filter.userType = userType;
        if (isActive !== undefined) filter.isActive = isActive === "true";
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }
        
        const users = await User.find(filter)
            .select("-password -resetOtp -resetOtpExpires")
            .sort({ createdAt: -1 });
        
        const stats = {
            total: users.length,
            active: users.filter(u => u.isActive).length,
            inactive: users.filter(u => !u.isActive).length,
            byUserType: {
                school_admin: users.filter(u => u.userType === "school_admin").length,
                teacher: users.filter(u => u.userType === "teacher").length,
                bursar: users.filter(u => u.userType === "bursar").length,
                stock_keeper: users.filter(u => u.userType === "stock_keeper").length,
                customer_care: users.filter(u => u.userType === "customer_care").length,
                staff: users.filter(u => u.userType === "staff").length,
                viewer: users.filter(u => u.userType === "viewer").length
            }
        };
        
        res.json({ users, stats });
    } catch (error) {
        console.error("Get school users error:", error);
        res.status(500).json({ message: error.message });
    }
};

// Create User (Super Admin or School Admin)
exports.createUser = async (req, res) => {
    try {
        const { 
            name, email, password, schoolId, 
            role, userType, permissions, 
            assignedGrades, assignedClasses, assignedCourses 
        } = req.body;
        
        // Determine which school to use
        let targetSchoolId = schoolId;
        if (req.user.role !== "superadmin") {
            targetSchoolId = req.user.schoolId;
            if (!targetSchoolId) {
                return res.status(403).json({ message: "No school association found" });
            }
        }
        
        // Validate required fields
        if (!name || !email || !targetSchoolId) {
            return res.status(400).json({ 
                message: "Please provide name, email, and school" 
            });
        }
        
        // Check if user already exists in this school
        const existingUser = await User.findOne({ 
            email: email.toLowerCase(), 
            school: targetSchoolId 
        });
        
        if (existingUser) {
            return res.status(400).json({ 
                message: "User with this email already exists in this school" 
            });
        }
        
        // Check if school exists
        const school = await School.findById(targetSchoolId);
        if (!school) {
            return res.status(404).json({ message: "School not found" });
        }
        
        // Check school status
        if (school.status === "suspended") {
            return res.status(403).json({ 
                message: "School is suspended. Cannot create new users." 
            });
        }
        
        // Determine final userType and role
        let finalUserType = userType;
        let finalRole = role;
        
        if (!finalUserType) {
            if (finalRole === "admin") finalUserType = "school_admin";
            else if (finalRole === "manager") finalUserType = "teacher";
            else if (finalRole === "staff") finalUserType = "staff";
            else finalUserType = "viewer";
        }
        
        if (!finalRole) {
            if (finalUserType === "school_admin") finalRole = "admin";
            else if (finalUserType === "teacher") finalRole = "manager";
            else if (finalUserType === "bursar") finalRole = "manager";
            else if (finalUserType === "stock_keeper") finalRole = "staff";
            else if (finalUserType === "customer_care") finalRole = "staff";
            else finalRole = "staff";
        }
        
        // Generate password
        const finalPassword = password || generateStrongPassword();
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(finalPassword, salt);
        
        // Create user
        const user = new User({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            password: hashedPassword,
            school: targetSchoolId,
            role: finalRole,
            userType: finalUserType,
            isActive: true,
            createdBy: req.user.id,
            createdByName: req.user.name,
            permissions: permissions || getDefaultPermissions(finalUserType),
            assignedGrades: assignedGrades || [],
            assignedClasses: assignedClasses || [],
            assignedCourses: assignedCourses || []
        });
        
        await user.save();
        
        const userResponse = user.toObject();
        delete userResponse.password;
        delete userResponse.resetOtp;
        delete userResponse.resetOtpExpires;
        
        const userTypeDisplay = {
            school_admin: "School Administrator",
            teacher: "Teacher",
            bursar: "Bursar/Accountant",
            stock_keeper: "Stock Keeper",
            customer_care: "Customer Care",
            staff: "Staff Member",
            viewer: "Viewer Only"
        }[finalUserType] || finalUserType;
        
        const displayText = generateCredentialDisplay(school, user, finalPassword, userTypeDisplay);
        console.log(displayText);
        
        res.status(201).json({
            success: true,
            message: "User created successfully!",
            user: userResponse,
            credentials: {
                schoolName: school.name,
                schoolCode: school.schoolCode,
                loginUrl: process.env.FRONTEND_URL || "http://localhost:5173",
                name: user.name,
                email: user.email,
                password: finalPassword,
                role: user.role,
                userType: user.userType,
                userTypeDisplay: userTypeDisplay
            },
            displayText: displayText
        });
        
    } catch (error) {
        console.error("Create user error:", error);
        res.status(500).json({ message: error.message });
    }
};

// Update user
exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            role, userType, isActive, permissions, 
            assignedGrades, assignedClasses, assignedCourses,
            name, phone 
        } = req.body;
        
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        
        // Security: Check access
        if (req.user.role !== "superadmin" && req.user.schoolId && user.school && req.user.schoolId.toString() !== user.school.toString()) {
            return res.status(403).json({ message: "Access denied to update this user" });
        }
        
        // Prevent deactivating the last school admin
        if (isActive === false && user.userType === "school_admin") {
            const activeAdminCount = await User.countDocuments({
                school: user.school,
                userType: "school_admin",
                isActive: true,
                _id: { $ne: user._id }
            });
            
            if (activeAdminCount === 0) {
                return res.status(400).json({ 
                    message: "Cannot deactivate the last school administrator. Please assign another admin first." 
                });
            }
        }
        
        // Update fields
        if (role) user.role = role;
        if (userType) user.userType = userType;
        if (isActive !== undefined) user.isActive = isActive;
        if (name) user.name = name;
        if (phone) user.phone = phone;
        
        if (permissions) {
            user.permissions = { ...user.permissions, ...permissions };
        }
        
        if (assignedGrades) user.assignedGrades = assignedGrades;
        if (assignedClasses) user.assignedClasses = assignedClasses;
        if (assignedCourses) user.assignedCourses = assignedCourses;
        
        await user.save();
        
        const updatedUser = await User.findById(id)
            .select("-password -resetOtp -resetOtpExpires")
            .populate("school", "name schoolCode");
        
        res.json({ 
            success: true,
            message: "User updated successfully", 
            user: updatedUser 
        });
        
    } catch (error) {
        console.error("Update user error:", error);
        res.status(500).json({ message: error.message });
    }
};

// Update user role (legacy)
exports.updateUserRole = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: "User not found" });
        
        if (req.body.role) user.role = req.body.role;
        if (req.body.userType) user.userType = req.body.userType;
        if (req.body.isActive !== undefined) user.isActive = req.body.isActive;
        
        if (req.body.userType && req.body.userType !== user.userType) {
            user.permissions = getDefaultPermissions(req.body.userType);
        }
        
        await user.save();
        
        const updatedUser = await User.findById(req.params.id)
            .select("-password")
            .populate("school", "name schoolCode");
        
        res.json({ 
            success: true,
            message: "User updated successfully", 
            user: updatedUser 
        });
    } catch (error) {
        console.error("Update user error:", error);
        res.status(500).json({ message: error.message });
    }
};

// Delete user
exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        
        // Security: Check access
        if (req.user.role !== "superadmin" && req.user.schoolId && user.school && req.user.schoolId.toString() !== user.school.toString()) {
            return res.status(403).json({ message: "Access denied to delete this user" });
        }
        
        // Prevent deleting the last school admin
        if (user.userType === "school_admin") {
            const schoolAdminCount = await User.countDocuments({ 
                school: user.school, 
                userType: "school_admin",
                isActive: true,
                _id: { $ne: user._id }
            });
            
            if (schoolAdminCount === 0) {
                return res.status(400).json({ 
                    message: "Cannot delete the last school administrator. Please assign another admin first." 
                });
            }
        }
        
        const userName = user.name;
        await User.deleteOne({ _id: req.params.id });
        
        res.json({ 
            success: true,
            message: `User "${userName}" deleted successfully` 
        });
    } catch (error) {
        console.error("Delete user error:", error);
        res.status(500).json({ message: error.message });
    }
};

// Reset user password
exports.resetUserPassword = async (req, res) => {
    try {
        const { userId } = req.params;
        
        const user = await User.findById(userId).populate("school", "name schoolCode");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        
        // Security: Check access
        if (req.user.role !== "superadmin" && req.user.schoolId && user.school && req.user.schoolId.toString() !== user.school._id.toString()) {
            return res.status(403).json({ message: "Access denied to reset this user's password" });
        }
        
        const newPassword = generateStrongPassword();
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        user.password = hashedPassword;
        await user.save();
        
        const userTypeDisplay = {
            school_admin: "School Administrator",
            teacher: "Teacher",
            bursar: "Bursar/Accountant",
            stock_keeper: "Stock Keeper",
            customer_care: "Customer Care",
            staff: "Staff Member",
            viewer: "Viewer Only"
        }[user.userType] || user.userType;
        
        const displayText = `
╔══════════════════════════════════════════════════════════════════════════════╗
║                           PASSWORD RESET SUCCESSFUL                          ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  School Name:    ${user.school?.name || "N/A"}
║  School Code:    ${user.school?.schoolCode || "N/A"}
║  Login URL:      ${process.env.FRONTEND_URL || "http://localhost:5173"}
║
║  User Details:
║  ┌────────────────────────────────────────────────────────────────────────┐
║  │ Name:        ${user.name}
║  │ Email:       ${user.email}
║  │ New Password: ${newPassword}
║  │ Role:        ${user.role} (${userTypeDisplay})
║  └────────────────────────────────────────────────────────────────────────┘
║
║  ⚠️  Please share these new credentials with the user.
║  ⚠️  The user should change their password after first login.
╚══════════════════════════════════════════════════════════════════════════════╝
        `;
        
        console.log(displayText);
        
        res.json({
            success: true,
            message: "Password reset successfully!",
            credentials: {
                schoolName: user.school?.name || "N/A",
                schoolCode: user.school?.schoolCode || "N/A",
                loginUrl: process.env.FRONTEND_URL || "http://localhost:5173",
                name: user.name,
                email: user.email,
                password: newPassword,
                role: user.role,
                userType: user.userType,
                userTypeDisplay: userTypeDisplay
            },
            displayText: displayText
        });
        
    } catch (error) {
        console.error("Reset password error:", error);
        res.status(500).json({ message: error.message });
    }
};

// ==================== DASHBOARD STATS ====================

// Dashboard stats (Super Admin)
exports.getDashboardStats = async (req, res) => {
    try {
        const totalSchools = await School.countDocuments();
        const activeSchools = await School.countDocuments({ status: "active" });
        const suspendedSchools = await School.countDocuments({ status: "suspended" });
        const pendingSchools = await School.countDocuments({ status: "pending" });
        
        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({ isActive: true });
        
        const userTypeDistribution = {
            superadmin: await User.countDocuments({ userType: "superadmin" }),
            school_admin: await User.countDocuments({ userType: "school_admin" }),
            teacher: await User.countDocuments({ userType: "teacher" }),
            bursar: await User.countDocuments({ userType: "bursar" }),
            stock_keeper: await User.countDocuments({ userType: "stock_keeper" }),
            customer_care: await User.countDocuments({ userType: "customer_care" }),
            staff: await User.countDocuments({ userType: "staff" }),
            viewer: await User.countDocuments({ userType: "viewer" })
        };
        
        const subscriptions = await Subscription.aggregate([
            { $group: { _id: "$plan", count: { $sum: 1 } } }
        ]);
        
        const recentSchools = await School.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .select("name schoolCode status createdAt");
        
        const recentUsers = await User.find()
            .select("-password")
            .populate("school", "name")
            .sort({ createdAt: -1 })
            .limit(5);
        
        res.json({
            schools: { 
                total: totalSchools, 
                active: activeSchools, 
                suspended: suspendedSchools,
                pending: pendingSchools 
            },
            users: { 
                total: totalUsers, 
                active: activeUsers,
                inactive: totalUsers - activeUsers,
                byUserType: userTypeDistribution
            },
            subscriptions,
            recentSchools,
            recentUsers
        });
    } catch (error) {
        console.error("Dashboard stats error:", error);
        res.status(500).json({ message: error.message });
    }
};

// School Admin Dashboard Stats
exports.getSchoolAdminStats = async (req, res) => {
    try {
        const schoolId = req.user.schoolId;
        
        if (!schoolId) {
            return res.status(403).json({ message: "No school association found" });
        }
        
        const school = await School.findById(schoolId);
        if (!school) {
            return res.status(404).json({ message: "School not found" });
        }
        
        const totalUsers = await User.countDocuments({ school: schoolId });
        const activeUsers = await User.countDocuments({ school: schoolId, isActive: true });
        
        const userTypeDistribution = {
            school_admin: await User.countDocuments({ school: schoolId, userType: "school_admin" }),
            teacher: await User.countDocuments({ school: schoolId, userType: "teacher" }),
            bursar: await User.countDocuments({ school: schoolId, userType: "bursar" }),
            stock_keeper: await User.countDocuments({ school: schoolId, userType: "stock_keeper" }),
            customer_care: await User.countDocuments({ school: schoolId, userType: "customer_care" }),
            staff: await User.countDocuments({ school: schoolId, userType: "staff" }),
            viewer: await User.countDocuments({ school: schoolId, userType: "viewer" })
        };
        
        const subscription = await Subscription.findOne({ school: schoolId });
        
        res.json({
            school: {
                id: school._id,
                name: school.name,
                code: school.schoolCode,
                status: school.status
            },
            users: {
                total: totalUsers,
                active: activeUsers,
                inactive: totalUsers - activeUsers,
                byUserType: userTypeDistribution
            },
            subscription: subscription ? {
                plan: subscription.plan,
                status: subscription.status,
                startDate: subscription.startDate,
                endDate: subscription.endDate
            } : null
        });
        
    } catch (error) {
        console.error("School admin stats error:", error);
        res.status(500).json({ message: error.message });
    }
};