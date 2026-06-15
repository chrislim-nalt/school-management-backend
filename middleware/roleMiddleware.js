// middleware/roleMiddleware.js

const User = require("../models/User");

/**
 * Role-based authorization middleware
 * Checks if the authenticated user has one of the allowed roles or userTypes
 * Super admin has automatic access to everything
 */
const authorize = (allowedRoles) => {
    // Ensure allowedRoles is always an array
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    
    return (req, res, next) => {
        // Check if user exists in request
        if (!req.user) {
            console.error("Authorize: No user context in request");
            return res.status(401).json({ 
                success: false,
                message: "Unauthorized: No user context found. Please login again." 
            });
        }
        
        const userRole = req.user.role || "unknown";
        const userType = req.user.userType || "unknown";
        
        // Super admin has access to everything
        if (userRole === "superadmin") {
            return next();
        }
        
        // Check if user's role or userType is in allowed roles
        const roleMatches = roles.includes(userRole) || roles.includes(userType);
        
        if (!roleMatches) {
            console.warn(`Access denied for user ${req.user.email || req.user.id} - Role: ${userRole}, Type: ${userType} - Required: ${roles.join(", ")}`);
            return res.status(403).json({ 
                success: false,
                message: "Forbidden: You don't have permission to access this resource",
                requiredRoles: roles,
                yourRole: userRole,
                yourUserType: userType
            });
        }
        
        next();
    };
};

/**
 * School-specific access middleware
 * Ensures the user belongs to the school they are trying to access
 * Super admin bypasses this check
 */
const requireSchoolAccess = (req, res, next) => {
    // Check if user exists
    if (!req.user) {
        console.error("requireSchoolAccess: No user context in request");
        return res.status(401).json({ 
            success: false,
            message: "Unauthorized: No user context found" 
        });
    }
    
    // Super admin has access to all schools
    if (req.user.role === "superadmin") {
        return next();
    }
    
    // Check if user has a school association
    if (!req.user.schoolId) {
        console.warn(`User ${req.user.email || req.user.id} has no school association`);
        return res.status(403).json({ 
            success: false,
            message: "Forbidden: No school association found for this user" 
        });
    }
    
    // Check if the requested schoolId matches user's school
    const requestedSchoolId = req.params.schoolId || req.body.schoolId;
    
    if (requestedSchoolId && requestedSchoolId !== req.user.schoolId.toString()) {
        console.warn(`User ${req.user.email} attempted to access school ${requestedSchoolId} but belongs to ${req.user.schoolId}`);
        return res.status(403).json({ 
            success: false,
            message: "Forbidden: You can only access resources for your own school" 
        });
    }
    
    next();
};

/**
 * Permission check for teacher/user actions
 * Verifies the user has specific permissions enabled
 */
const checkTeacherPermissions = (permission) => {
    return async (req, res, next) => {
        // Check if user exists
        if (!req.user || !req.user.id) {
            return res.status(401).json({ 
                success: false,
                message: "Unauthorized: No user context found" 
            });
        }
        
        try {
            // Fetch full user with permissions from database
            const user = await User.findById(req.user.id)
                .select("permissions userType role name email");
            
            if (!user) {
                console.error(`checkTeacherPermissions: User not found - ID: ${req.user.id}`);
                return res.status(404).json({ 
                    success: false,
                    message: "User not found" 
                });
            }
            
            // Super admin has all permissions
            if (user.role === "superadmin") {
                return next();
            }
            
            // School admin has all permissions for school operations
            if (user.userType === "school_admin") {
                return next();
            }
            
            // Check if user has the required permission
            if (!user.permissions || !user.permissions[permission]) {
                const permissionDisplay = permission.replace('can', '').toLowerCase();
                console.warn(`User ${user.email} (${user.userType}) lacks permission: ${permission}`);
                return res.status(403).json({ 
                    success: false,
                    message: `Forbidden: You don't have permission to ${permissionDisplay}`,
                    missingPermission: permission,
                    userType: user.userType
                });
            }
            
            next();
        } catch (error) {
            console.error(`checkTeacherPermissions error:`, error);
            res.status(500).json({ 
                success: false,
                message: "Internal server error while checking permissions" 
            });
        }
    };
};

/**
 * Check if user is a teacher (for teacher-specific routes)
 */
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
    
    if (req.user.userType === "teacher") {
        return next();
    }
    
    return res.status(403).json({ 
        success: false,
        message: "Forbidden: This resource is only accessible by teachers" 
    });
};

/**
 * Check if user is a school admin
 */
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
    
    if (req.user.userType === "school_admin") {
        return next();
    }
    
    return res.status(403).json({ 
        success: false,
        message: "Forbidden: This resource is only accessible by school administrators" 
    });
};

/**
 * Check if user is a bursar (financial operations)
 */
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
    
    if (req.user.userType === "bursar" || req.user.userType === "school_admin") {
        return next();
    }
    
    return res.status(403).json({ 
        success: false,
        message: "Forbidden: This resource is only accessible by bursar or administrator" 
    });
};

/**
 * Check if user is customer care (visitor management)
 */
const isCustomerCare = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ 
            success: false,
            message: "Unauthorized: No user context found" 
        });
    }
    
    if (req.user.role === "superadmin") {
        return next();
    }
    
    if (req.user.userType === "customer_care" || req.user.userType === "school_admin") {
        return next();
    }
    
    return res.status(403).json({ 
        success: false,
        message: "Forbidden: This resource is only accessible by customer care or administrator" 
    });
};

/**
 * Check if user is stock keeper
 */
const isStockKeeper = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ 
            success: false,
            message: "Unauthorized: No user context found" 
        });
    }
    
    if (req.user.role === "superadmin") {
        return next();
    }
    
    if (req.user.userType === "stock_keeper" || req.user.userType === "school_admin") {
        return next();
    }
    
    return res.status(403).json({ 
        success: false,
        message: "Forbidden: This resource is only accessible by stock keeper or administrator" 
    });
};

/**
 * Combined middleware to check if user has any of the allowed user types
 */
const hasUserType = (allowedUserTypes) => {
    const allowed = Array.isArray(allowedUserTypes) ? allowedUserTypes : [allowedUserTypes];
    
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
                success: false,
                message: "Unauthorized: No user context found" 
            });
        }
        
        if (req.user.role === "superadmin") {
            return next();
        }
        
        if (allowed.includes(req.user.userType)) {
            return next();
        }
        
        return res.status(403).json({ 
            success: false,
            message: `Forbidden: This resource requires one of these user types: ${allowed.join(", ")}`,
            yourUserType: req.user.userType
        });
    };
};

module.exports = { 
    authorize, 
    requireSchoolAccess, 
    checkTeacherPermissions,
    isTeacher,
    isSchoolAdmin,
    isBursar,
    isCustomerCare,
    isStockKeeper,
    hasUserType
};