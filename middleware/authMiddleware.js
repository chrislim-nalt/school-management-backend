const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    
    if (!token) {
        return res.status(401).json({ message: "No token, authorization denied" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Populate user object with all necessary fields
        req.user = {
            id: decoded.id,
            email: decoded.email,
            name: decoded.name,
            role: decoded.role,
            schoolId: decoded.schoolId || null,  // Ensure null instead of undefined
            schoolCode: decoded.schoolCode || null,
            schoolName: decoded.schoolName || null
        };
        
        // Optional: Add logging for debugging
        if (process.env.NODE_ENV === 'development') {
            console.log(`Auth: User ${req.user.email} (${req.user.role}) authenticated`);
            if (req.user.schoolId) {
                console.log(`Auth: Associated with school ${req.user.schoolId}`);
            } else {
                console.log(`Auth: No school association (Global user)`);
            }
        }
        
        next();
    } catch (error) {
        console.error("Auth middleware error:", error);
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: "Token has expired, please login again" });
        }
        
        res.status(401).json({ message: "Token is not valid" });
    }
};