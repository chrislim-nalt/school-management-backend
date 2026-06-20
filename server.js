const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const { scheduleWeeklyReport, checkStartupReport } = require("./cronJobs");
const User = require("./models/User");
const bcrypt = require("bcryptjs");

dotenv.config();

// Function to ensure Super Admin exists
const ensureSuperAdminExists = async () => {
    try {
        const superAdminExists = await User.findOne({ role: "superadmin" });
        
        if (!superAdminExists) {
            console.log("⚠️ No Super Admin found. Creating default Super Admin...");
            
            const salt = await bcrypt.genSalt(10);
            const defaultPassword = "Admin123!chris";
            const hashedPassword = await bcrypt.hash(defaultPassword, salt);
            
            const defaultSuperAdmin = new User({
                name: "Super Administrator",
                email: "admin@chris.com",
                password: hashedPassword,
                role: "superadmin",
                userType: "superadmin",
                isActive: true,
            });
            
            await defaultSuperAdmin.save();
            
            console.log("✅ Default Super Admin created successfully!");
            console.log("=".repeat(60));
            console.log("📋 DEFAULT SUPER ADMIN CREDENTIALS:");
            console.log(`   Email: admin@chris.com`);
            console.log(`   Password: ${defaultPassword}`);
            console.log("=".repeat(60));
            console.log("⚠️ IMPORTANT: Please change this password after first login!");
            console.log("=".repeat(60));
        } else {
            console.log("✅ Super Admin already exists");
            console.log(`   Email: ${superAdminExists.email}`);
        }
    } catch (error) {
        console.error("❌ Error ensuring Super Admin exists:", error.message);
    }
};

// Start server function
const startServer = async () => {
    // Connect to MongoDB
    const dbConnected = await connectDB();
    
    // Only create Super Admin if database connected successfully
    if (dbConnected) {
        await ensureSuperAdminExists();
    } else {
        console.log("⚠️ Waiting for database connection to create Super Admin...");
        setTimeout(async () => {
            if (dbConnected) {
                await ensureSuperAdminExists();
            }
        }, 10000);
    }
    
    const app = express();
    
    // ==================== UPDATED CORS CONFIGURATION ====================
    // Allow multiple origins including your deployed frontend
    const allowedOrigins = [
        'http://localhost:5173',
        'http://localhost:3000',
        'http://localhost:5000',
        'https://school-management-frontend.vercel.app',
        'https://school-management-frontend-git-main.vercel.app',
        'https://school-management-frontend-h08y.vercel.app',
        process.env.FRONTEND_URL || 'https://school-inventory-frontend.vercel.app'
    ];

    app.use(cors({
        origin: function (origin, callback) {
            // Allow requests with no origin (like mobile apps or curl requests)
            if (!origin) return callback(null, true);
            
            if (allowedOrigins.indexOf(origin) !== -1) {
                callback(null, true);
            } else {
                console.log(`❌ CORS blocked origin: ${origin}`);
                callback(null, true); // Allow all in development
            }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
    }));

    app.use(express.json());
    
    // ==================== HEALTH CHECK ====================
    app.get("/health", (req, res) => {
        res.status(200).json({ 
            status: "ok", 
            message: "Server is running",
            mongodb: dbConnected ? "connected" : "disconnected",
            timestamp: new Date().toISOString()
        });
    });
    
    // ==================== ROOT ENDPOINT ====================
    app.get("/", (req, res) => {
        res.json({
            name: "School Inventory Management System",
            version: "2.0.0",
            status: "running",
            mongodb: dbConnected ? "connected" : "connecting...",
            modules: {
                inventory: "/api/items, /api/categories, /api/stock",
                feeding: "/api/feeding",
                library: "/api/library",
                laboratory: "/api/laboratory",
                assets: "/api/assets, /api/tracked-assets",
                cleaning: "/api/cleaning-supplies",
                schoolManagement: "/api/teachers, /api/students, /api/courses, /api/marks, /api/attendance, /api/transport, /api/reports"
            },
            endpoints: {
                health: "/health",
                api: "/api"
            }
        });
    });
    
    // ==================== EXISTING API ROUTES ====================
    try {
        app.use("/api/stock", require("./routes/stockRoutes"));
        console.log("✅ Stock routes loaded");
    } catch (error) {
        console.error("❌ Failed to load stock routes:", error.message);
    }
    
    try {
        app.use("/api/categories", require("./routes/categoryRoutes"));
        console.log("✅ Category routes loaded");
    } catch (error) {
        console.error("❌ Failed to load category routes:", error.message);
    }
    
    try {
        app.use("/api/items", require("./routes/itemRoutes"));
        console.log("✅ Item routes loaded");
    } catch (error) {
        console.error("❌ Failed to load item routes:", error.message);
    }
    
    try {
        app.use("/api/auth", require("./routes/auth"));
        console.log("✅ Auth routes loaded");
    } catch (error) {
        console.error("❌ Failed to load auth routes:", error.message);
    }
    
    try {
        app.use("/api/feeding", require("./routes/feedingRoutes"));
        console.log("✅ Feeding routes loaded");
    } catch (error) {
        console.error("❌ Failed to load feeding routes:", error.message);
    }
    
    try {
        app.use("/api/stock-periods", require("./routes/stockPeriodRoutes"));
        console.log("✅ Stock period routes loaded");
    } catch (error) {
        console.error("❌ Failed to load stock period routes:", error.message);
    }
    
    try {
        app.use("/api/stock-records", require("./routes/stockRecordRoutes"));
        console.log("✅ Stock record routes loaded");
    } catch (error) {
        console.error("❌ Failed to load stock record routes:", error.message);
    }
    
    try {
        app.use("/api/tracked-assets", require("./routes/trackedAssetRoutes"));
        console.log("✅ Tracked asset routes loaded");
    } catch (error) {
        console.error("❌ Failed to load tracked asset routes:", error.message);
    }
    
    try {
        app.use("/api/projected-needs", require("./routes/projectedNeedRoutes"));
        console.log("✅ Projected needs routes loaded");
    } catch (error) {
        console.error("❌ Failed to load projected needs routes:", error.message);
    }
    
    try {
        app.use("/api/assets", require("./routes/assetRoutes"));
        console.log("✅ Asset routes loaded");
    } catch (error) {
        console.error("❌ Failed to load asset routes:", error.message);
    }
    
    try {
        app.use("/api/cleaning-supplies", require("./routes/cleaningSupplyRoutes"));
        console.log("✅ Cleaning supplies routes loaded");
    } catch (error) {
        console.error("❌ Failed to load cleaning supplies routes:", error.message);
    }
    
    try {
        app.use("/api/laboratory", require("./routes/laboratoryRoutes"));
        console.log("✅ Laboratory routes loaded");
    } catch (error) {
        console.error("❌ Failed to load laboratory routes:", error.message);
    }
    
    try {
        app.use("/api/library", require("./routes/libraryRoutes"));
        console.log("✅ Library routes loaded");
    } catch (error) {
        console.error("❌ Failed to load library routes:", error.message);
    }
    
    try {
        app.use("/api/admin", require("./routes/adminRoutes"));
        console.log("✅ Admin routes loaded");
    } catch (error) {
        console.error("❌ Failed to load admin routes:", error.message);
    }
    
    // ==================== SCHOOL MANAGEMENT API ROUTES ====================
    try {
        app.use("/api/teachers", require("./routes/teacherRoutes"));
        console.log("✅ Teacher routes loaded");
    } catch (error) {
        console.error("❌ Failed to load teacher routes:", error.message);
    }
    
    try {
        app.use("/api/students", require("./routes/studentRoutes"));
        console.log("✅ Student routes loaded");
    } catch (error) {
        console.error("❌ Failed to load student routes:", error.message);
    }
    
    try {
        app.use("/api/courses", require("./routes/courseRoutes"));
        console.log("✅ Course routes loaded");
    } catch (error) {
        console.error("❌ Failed to load course routes:", error.message);
    }
    
    try {
        app.use("/api/marks", require("./routes/markRoutes"));
        console.log("✅ Mark routes loaded");
    } catch (error) {
        console.error("❌ Failed to load mark routes:", error.message);
    }
    
    try {
        app.use("/api/attendance", require("./routes/attendanceRoutes"));
        console.log("✅ Attendance routes loaded");
    } catch (error) {
        console.error("❌ Failed to load attendance routes:", error.message);
    }
    
    try {
        app.use("/api/transport", require("./routes/transportRoutes"));
        console.log("✅ Transport routes loaded");
    } catch (error) {
        console.error("❌ Failed to load transport routes:", error.message);
    }
    
    try {
        app.use("/api/reports", require("./routes/reportRoutes"));
        console.log("✅ Report routes loaded");
    } catch (error) {
        console.error("❌ Failed to load report routes:", error.message);
    }
    
    // ==================== NEW SCHOOL OPERATIONS ROUTES ====================
    try {
        app.use("/api/permissions", require("./routes/permissionRoutes"));
        console.log("✅ Permission routes loaded");
    } catch (error) {
        console.error("❌ Failed to load permission routes:", error.message);
    }
    
    try {
        app.use("/api/discipline", require("./routes/disciplineRoutes"));
        console.log("✅ Discipline routes loaded");
    } catch (error) {
        console.error("❌ Failed to load discipline routes:", error.message);
    }
    
    try {
        app.use("/api/english-performance", require("./routes/englishPerformanceRoutes"));
        console.log("✅ English performance routes loaded");
    } catch (error) {
        console.error("❌ Failed to load english performance routes:", error.message);
    }
    
    try {
        app.use("/api/homework", require("./routes/homeworkRoutes"));
        console.log("✅ Homework routes loaded");
    } catch (error) {
        console.error("❌ Failed to load homework routes:", error.message);
    }
    
    try {
        app.use("/api/slow-learners", require("./routes/slowLearnerRoutes"));
        console.log("✅ Slow learner routes loaded");
    } catch (error) {
        console.error("❌ Failed to load slow learner routes:", error.message);
    }
    
    // ==================== VISITOR ROUTES ====================
    try {
        app.use("/api/visitors", require("./routes/visitorRoutes"));
        console.log("✅ Visitor routes loaded");
    } catch (error) {
        console.error("❌ Failed to load visitor routes:", error.message);
    }
    
    try {
        app.use("/api/activities", require("./routes/activityRoutes"));
        console.log("✅ Activity routes loaded");
    } catch (error) {
        console.error("❌ Failed to load activity routes:", error.message);
    }
    
    // ==================== 404 HANDLER ====================
    app.use((req, res) => {
        console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
        res.status(404).json({ 
            message: "Route not found",
            requestedUrl: req.originalUrl,
            method: req.method
        });
    });
    
    // ==================== ERROR HANDLER ====================
    app.use((err, req, res, next) => {
        console.error("Error:", err.message);
        console.error("Stack:", err.stack);
        res.status(500).json({ 
            message: "Internal server error",
            error: process.env.NODE_ENV === "development" ? err.message : undefined
        });
    });
    
    // ==================== CRON JOBS ====================
    try {
        scheduleWeeklyReport();
        setTimeout(() => {
            checkStartupReport();
        }, 5000);
        console.log("📅 Cron jobs initialized");
    } catch (error) {
        console.error("❌ Failed to initialize cron jobs:", error.message);
    }
    
    // ==================== START SERVER ====================
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log("\n" + "=".repeat(60));
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📍 Health check: http://localhost:${PORT}/health`);
        console.log(`📦 Inventory API: http://localhost:${PORT}/api/items`);
        console.log(`🎓 School Management API: http://localhost:${PORT}/api/teachers`);
        console.log(`👥 Visitor API: http://localhost:${PORT}/api/visitors`);
        console.log(`📊 MongoDB Status: ${dbConnected ? "Connected ✅" : "Connecting... ⏳"}`);
        console.log("=".repeat(60) + "\n");
    });
};

// Start the server
startServer();