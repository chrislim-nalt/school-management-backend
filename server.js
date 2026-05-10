const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const { scheduleWeeklyReport, checkStartupReport } = require("./cronJobs");

dotenv.config();
connectDB();

const app = express();

app.use(cors());
app.use(express.json());

// ==================== HEALTH CHECK ====================
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "ok", 
    message: "Server is running",
    timestamp: new Date().toISOString()
  });
});

// ==================== ROOT ENDPOINT ====================
app.get("/", (req, res) => {
  res.json({
    name: "School Inventory Management System",
    version: "1.0.0",
    status: "running",
    endpoints: {
      health: "/health",
      api: "/api"
    }
  });
});

// ==================== API ROUTES ====================
app.use("/api/stock", require("./routes/stockRoutes"));
app.use("/api/categories", require("./routes/categoryRoutes"));
app.use("/api/items", require("./routes/itemRoutes"));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/feeding", require("./routes/feedingRoutes"));
app.use("/api/stock-periods", require("./routes/stockPeriodRoutes"));
app.use("/api/stock-records", require("./routes/stockRecordRoutes"));
app.use("/api/tracked-assets", require("./routes/trackedAssetRoutes"));
app.use("/api/projected-needs", require("./routes/projectedNeedRoutes"));
app.use("/api/assets", require("./routes/assetRoutes"));
app.use("/api/cleaning-supplies", require("./routes/cleaningSupplyRoutes"));
app.use("/api/laboratory", require("./routes/laboratoryRoutes"));
app.use("/api/library", require("./routes/libraryRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));

// ==================== 404 HANDLER ====================
app.use((req, res) => {
  res.status(404).json({ 
    message: "Route not found",
    requestedUrl: req.originalUrl
  });
});

// ==================== ERROR HANDLER ====================
app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  res.status(500).json({ 
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined
  });
});

// ==================== CRON JOBS ====================
scheduleWeeklyReport();
setTimeout(() => {
    checkStartupReport();
}, 5000);

// ==================== START SERVER ====================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
});