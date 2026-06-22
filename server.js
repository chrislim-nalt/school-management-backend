const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

// ==================== CORS CONFIGURATION ====================
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://localhost:3001',
  'https://smis-2026.vercel.app',
  'https://smis-2026-git-main.vercel.app',
  process.env.FRONTEND_URL,
  process.env.VERCEL_URL
].filter(Boolean);

console.log("CORS allowed origins:", allowedOrigins);

// CORS middleware with proper error handling
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      console.log(`❌ CORS blocked: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

// ==================== MIDDLEWARE ====================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log all requests
app.use((req, res, next) => {
  console.log(`✅ ${req.method} ${req.url}`);
  next();
});

// ==================== ROUTES ====================
// Import routes
const authRoutes = require("./routes/auth");
const studentRoutes = require("./routes/studentRoutes");
const teacherRoutes = require("./routes/teacherRoutes");
const courseRoutes = require("./routes/courseRoutes");
const markRoutes = require("./routes/markRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const transportRoutes = require("./routes/transportRoutes");
const reportRoutes = require("./routes/reportRoutes");
const permissionRoutes = require("./routes/permissionRoutes");
const disciplineRoutes = require("./routes/disciplineRoutes");
const englishPerformanceRoutes = require("./routes/englishPerformanceRoutes");
const homeworkRoutes = require("./routes/homeworkRoutes");
const slowLearnerRoutes = require("./routes/slowLearnerRoutes");
const visitorRoutes = require("./routes/visitorRoutes");
const activityRoutes = require("./routes/activityRoutes");
const adminRoutes = require("./routes/adminRoutes");

// Inventory routes
const categoryRoutes = require("./routes/categoryRoutes");
const itemRoutes = require("./routes/itemRoutes");
const stockRoutes = require("./routes/stockRoutes");
const assetRoutes = require("./routes/assetRoutes");
const trackedAssetRoutes = require("./routes/trackedAssetRoutes");
const libraryRoutes = require("./routes/libraryRoutes");
const laboratoryRoutes = require("./routes/laboratoryRoutes");
const cleaningSuppliesRoutes = require("./routes/cleaningSupplyRoutes");
const feedingRoutes = require("./routes/feedingRoutes");
const projectedNeedsRoutes = require("./routes/projectedNeedRoutes");
const stockPeriodRoutes = require("./routes/stockPeriodRoutes");
const stockRecordRoutes = require("./routes/stockRecordRoutes");

// Use routes - NO WILDCARD '*' ROUTES HERE
app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/marks", markRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/transport", transportRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/discipline", disciplineRoutes);
app.use("/api/english-performance", englishPerformanceRoutes);
app.use("/api/homework", homeworkRoutes);
app.use("/api/slow-learners", slowLearnerRoutes);
app.use("/api/visitors", visitorRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/admin", adminRoutes);

app.use("/api/categories", categoryRoutes);
app.use("/api/items", itemRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/assets", assetRoutes);
app.use("/api/tracked-assets", trackedAssetRoutes);
app.use("/api/library", libraryRoutes);
app.use("/api/laboratory", laboratoryRoutes);
app.use("/api/cleaning-supplies", cleaningSuppliesRoutes);
app.use("/api/feeding", feedingRoutes);
app.use("/api/projected-needs", projectedNeedsRoutes);
app.use("/api/stock-periods", stockPeriodRoutes);
app.use("/api/stock-records", stockRecordRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

// ==================== 404 HANDLER ====================
// This catches all unmatched routes - USE app.use NOT app.get('*')
app.use((req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.url}`);
  res.status(404).json({ 
    success: false, 
    message: `Route not found: ${req.method} ${req.url}` 
  });
});

// ==================== ERROR HANDLER ====================
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.message);
  console.error("Stack:", err.stack);
  res.status(500).json({ 
    success: false, 
    message: err.message || "Internal server error" 
  });
});

// ==================== DATABASE CONNECTION ====================
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected");
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error.message);
    process.exit(1);
  }
};

// ==================== START SERVER ====================
const PORT = process.env.PORT || 10000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n============================================================`);
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/health`);
    console.log(`📦 Inventory API: http://localhost:${PORT}/api/items`);
    console.log(`🎓 School Management API: http://localhost:${PORT}/api/teachers`);
    console.log(`👥 Visitor API: http://localhost:${PORT}/api/visitors`);
    console.log(`📊 MongoDB Status: Connected ✅`);
    console.log(`============================================================\n`);
  });
});

module.exports = app;