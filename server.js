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
        'https://school-inventory-frontend.vercel.app',
        process.env.FRONTEND_URL
    ].filter(Boolean);

    // Enable CORS with options
    app.use(cors({
        origin: function (origin, callback) {
            // Allow requests with no origin (like mobile apps or curl requests)
            if (!origin) {
                console.log("✅ No origin - allowing");
                return callback(null, true);
            }
            
            // Check if origin is allowed
            if (allowedOrigins.some(allowed => origin.includes(allowed) || allowed === '*')) {
                console.log(`✅ CORS allowed: ${origin}`);
                callback(null, true);
            } else {
                // In development, allow all
                if (process.env.NODE_ENV !== 'production') {
                    console.log(`⚠️ CORS allowing all in dev: ${origin}`);
                    callback(null, true);
                } else {
                    console.log(`❌ CORS blocked: ${origin}`);
                    callback(new Error('Not allowed by CORS'), false);
                }
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
    const routeFiles = {
        stock: "./routes/stockRoutes",
        categories: "./routes/categoryRoutes",
        items: "./routes/itemRoutes",
        auth: "./routes/auth",
        feeding: "./routes/feedingRoutes",
        "stock-periods": "./routes/stockPeriodRoutes",
        "stock-records": "./routes/stockRecordRoutes",
        "tracked-assets": "./routes/trackedAssetRoutes",
        "projected-needs": "./routes/projectedNeedRoutes",
        assets: "./routes/assetRoutes",
        "cleaning-supplies": "./routes/cleaningSupplyRoutes",
        laboratory: "./routes/laboratoryRoutes",
        library: "./routes/libraryRoutes",
        admin: "./routes/adminRoutes",
        teachers: "./routes/teacherRoutes",
        students: "./routes/studentRoutes",
        courses: "./routes/courseRoutes",
        marks: "./routes/markRoutes",
        attendance: "./routes/attendanceRoutes",
        transport: "./routes/transportRoutes",
        reports: "./routes/reportRoutes",
        permissions: "./routes/permissionRoutes",
        discipline: "./routes/disciplineRoutes",
        "english-performance": "./routes/englishPerformanceRoutes",
        homework: "./routes/homeworkRoutes",
        "slow-learners": "./routes/slowLearnerRoutes",
        visitors: "./routes/visitorRoutes",
        activities: "./routes/activityRoutes"
    };

    Object.entries(routeFiles).forEach(([name, path]) => {
        try {
            app.use(`/api/${name}`, require(path));
            console.log(`✅ ${name.charAt(0).toUpperCase() + name.slice(1)} routes loaded`);
        } catch (error) {
            console.error(`❌ Failed to load ${name} routes:`, error.message);
        }
    });
    
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
        console.error("❌ Error:", err.message);
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