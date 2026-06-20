const jwt = require("jsonwebtoken");

// Main authentication middleware
const authMiddleware = (req, res, next) => {
    let token = req.header("Authorization")?.replace("Bearer ", "");
    
    if (!token && req.header("Authorization")) {
        token = req.header("Authorization");
    }
    
    if (!token) {
        console.log("❌ No token provided in request");
        return res.status(401).json({ 
            success: false,
            message: "No token, authorization denied",
            requiresAuth: true 
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        req.user = {
            id: decoded.id,
            email: decoded.email,
            name: decoded.name,
            role: decoded.role || "staff",
            userType: decoded.userType || decoded.role || "staff",
            schoolId: decoded.schoolId || null,
            schoolCode: decoded.schoolCode || null,
            schoolName: decoded.schoolName || null
        };
        
        // Log for debugging
        console.log(`✅ Auth: ${req.user.email} (${req.user.userType}) - School: ${req.user.schoolId}`);
        
        next();
    } catch (error) {
        console.error("❌ Auth error:", error.message);
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false,
                message: "Token has expired, please login again",
                tokenExpired: true
            });
        }
        
        res.status(401).json({ 
            success: false,
            message: "Token is not valid" 
        });
    }
};

// Role-based authorization middleware
const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
                success: false,
                message: "Unauthorized: No user context" 
            });
        }
        
        // Super admin has access to everything
        if (req.user.role === "superadmin") {
            return next();
        }
        
        // Check if user's role or userType is in allowed roles
        const userRole = req.user.role || "";
        const userType = req.user.userType || "";
        
        const hasAccess = allowedRoles.some(role => 
            userRole === role || 
            userType === role ||
            (role === "school_admin" && userType === "admin") // Handle legacy naming
        );
        
        if (!hasAccess) {
            console.warn(`❌ Access denied: ${req.user.email} (${req.user.userType}) attempted to access ${req.originalUrl}`);
            return res.status(403).json({ 
                success: false,
                message: "Forbidden: You don't have permission to access this resource",
                requiredRoles: allowedRoles,
                yourRole: req.user.role,
                yourUserType: req.user.userType
            });
        }
        
        next();
    };
};

// School-specific access middleware
const requireSchoolAccess = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ 
            success: false,
            message: "Unauthorized: No user context" 
        });
    }
    
    // Super admin bypasses school check
    if (req.user.role === "superadmin") {
        return next();
    }
    
    // Check if user has school association
    if (!req.user.schoolId) {
        return res.status(403).json({ 
            success: false,
            message: "Forbidden: No school association found" 
        });
    }
    
    // Always attach schoolId to req for filtering
    req.schoolId = req.user.schoolId;
    next();
};

// Teacher-specific middleware
const isTeacher = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ 
            success: false,
            message: "Unauthorized: No user context found" 
        });
    }
    
    if (req.user.role === "superadmin") {
        return next();
    }
    
    if (req.user.userType === "teacher" || req.user.userType === "staff") {
        return next();
    }
    
    return res.status(403).json({ 
        success: false,
        message: "Forbidden: This resource is only accessible by teachers" 
    });
};

// School admin middleware
const isSchoolAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ 
            success: false,
            message: "Unauthorized: No user context found" 
        });
    }
    
    if (req.user.role === "superadmin") {
        return next();
    }
    
    if (req.user.userType === "school_admin" || req.user.userType === "admin") {
        return next();
    }
    
    return res.status(403).json({ 
        success: false,
        message: "Forbidden: This resource is only accessible by school administrators" 
    });
};

// Bursar middleware
const isBursar = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ 
            success: false,
            message: "Unauthorized: No user context found" 
        });
    }
    
    if (req.user.role === "superadmin") {
        return next();
    }
    
    if (req.user.userType === "bursar" || req.user.userType === "school_admin" || req.user.userType === "admin") {
        return next();
    }
    
    return res.status(403).json({ 
        success: false,
        message: "Forbidden: This resource is only accessible by bursar or administrator" 
    });
};

// Permission check for teacher actions
const checkTeacherPermissions = (permission) => {
    return async (req, res, next) => {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ 
                success: false,
                message: "Unauthorized: No user context found" 
            });
        }
        
        // Super admin has all permissions
        if (req.user.role === "superadmin") {
            return next();
        }
        
        // School admin has all permissions
        if (req.user.userType === "school_admin" || req.user.userType === "admin") {
            return next();
        }
        
        // For teachers, we need to check permissions from Teacher model
        try {
            const Teacher = require("../models/Teacher");
            const teacher = await Teacher.findOne({ 
                email: req.user.email,
                school: req.user.schoolId
            });
            
            if (!teacher) {
                return res.status(403).json({ 
                    success: false,
                    message: "Teacher record not found" 
                });
            }
            
            // Check specific permission
            const permissionMap = {
                "canAddMarks": teacher.permissions?.canAddMarks,
                "canManageAttendance": teacher.permissions?.canManageAttendance,
                "canViewReports": teacher.permissions?.canViewReports
            };
            
            const hasPermission = permissionMap[permission];
            
            if (hasPermission === false) {
                return res.status(403).json({ 
                    success: false,
                    message: `Forbidden: You don't have permission to ${permission.replace('can', '').toLowerCase()}`,
                    missingPermission: permission
                });
            }
            
            next();
        } catch (error) {
            console.error("checkTeacherPermissions error:", error);
            res.status(500).json({ 
                success: false,
                message: "Internal server error while checking permissions" 
            });
        }
    };
};

module.exports = authMiddleware;
module.exports.protect = authMiddleware;
module.exports.authorize = authorize;
module.exports.requireSchoolAccess = requireSchoolAccess;
module.exports.isTeacher = isTeacher;
module.exports.isSchoolAdmin = isSchoolAdmin;
module.exports.isBursar = isBursar;
module.exports.checkTeacherPermissions = checkTeacherPermissions;