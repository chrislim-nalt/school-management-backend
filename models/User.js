const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true },
    phone: { type: String, default: "" },
    password: { type: String, required: true },
    school: { type: mongoose.Schema.Types.ObjectId, ref: "School" },
    
    // Role Management - Extended for school operations
    role: { 
        type: String, 
        enum: ["superadmin", "admin", "manager", "staff", "viewer"], 
        default: "staff" 
    },
    
    // NEW: User type for granular school-level role control
    userType: { 
        type: String, 
        enum: ["superadmin", "school_admin", "teacher", "bursar", "stock_keeper", "customer_care", "viewer", "staff"],
        default: "staff"
    },
    
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
    
    // Security questions for self-recovery
    securityQuestion: { type: String, default: "" },
    securityAnswer: { type: String, default: "" },
    
    // For password reset
    resetOtp: { type: String, default: null },
    resetOtpExpires: { type: Date, default: null },
    
    // NEW: Track who created this user (for audit)
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdByName: { type: String, default: "" },
    
    // NEW: Teacher-specific permissions (only applies if userType is "teacher")
    permissions: {
        canManageAttendance: { type: Boolean, default: true },
        canManageMarks: { type: Boolean, default: true },
        canManageDiscipline: { type: Boolean, default: true },
        canManageHomework: { type: Boolean, default: true },
        canViewEnglishPerformance: { type: Boolean, default: true },
        canViewSlowLearners: { type: Boolean, default: false },
        canManageActivities: { type: Boolean, default: true }
    },
    
    // NEW: User metadata
    profilePicture: { type: String, default: "" },
    employeeId: { type: String, default: "" },
    hireDate: { type: Date },
    department: { type: String, default: "" },
    
    // NEW: For teacher-student relationship (which classes they teach)
    assignedGrades: [{ type: String }],
    assignedClasses: [{ type: String }],
    assignedCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }]

}, { timestamps: true });

// Index for faster queries
UserSchema.index({ email: 1, school: 1 });
UserSchema.index({ userType: 1 });
UserSchema.index({ school: 1, isActive: 1 });

module.exports = mongoose.model("User", UserSchema);