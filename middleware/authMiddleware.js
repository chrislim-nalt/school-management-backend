const jwt = require("jsonwebtoken");

// Main authentication middleware
const authMiddleware = (req, res, next) => {
    // Get token from header
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
        
        // Populate user object with all necessary fields
        req.user = {
            id: decoded.id,
            email: decoded.email,
            name: decoded.name,
            role: decoded.role,
            userType: decoded.userType || decoded.role,
            schoolId: decoded.schoolId || null,
            schoolCode: decoded.schoolCode || null,
            schoolName: decoded.schoolName || null
        };
        
        if (process.env.NODE_ENV === 'development') {
            console.log(`✅ Auth: ${req.user.email} (${req.user.role}/${req.user.userType})`);
        }
        
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
        const hasAccess = allowedRoles.includes(req.user.role) || allowedRoles.includes(req.user.userType);
        
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
    
    // Check if requested schoolId matches user's school
    const requestedSchoolId = req.params.schoolId || req.body.schoolId;
    if (requestedSchoolId && requestedSchoolId !== req.user.schoolId.toString()) {
        return res.status(403).json({ 
            success: false,
            message: "Forbidden: You can only access resources for your own school" 
        });
    }
    
    next();
};

// Export all middleware
module.exports = authMiddleware;
module.exports.protect = authMiddleware;
module.exports.authorize = authorize;
module.exports.requireSchoolAccess = requireSchoolAccess;