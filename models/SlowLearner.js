const mongoose = require("mongoose");

const slowLearnerSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  studentName: { type: String, required: true },
  studentId: { type: String, required: true },
  grade: { type: String, required: true },
  className: { type: String, required: true },
  
  // Problem details
  problemDescription: { type: String, required: true },
  problemCategory: { 
    type: String, 
    enum: ["READING", "WRITING", "MATHEMATICS", "ATTENTION", "MEMORY", "OTHER"],
    required: true 
  },
  
  // Measures taken
  measuresTaken: [{ type: String }],
  
  // Progress tracking
  progressNotes: [{
    note: { type: String },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    recordedByName: { type: String },
    recordedAt: { type: Date, default: Date.now },
    improvementLevel: { type: Number, min: 0, max: 100 }
  }],
  
  // ===== NEW FIELDS FOR PERFORMANCE TRACKING =====
  performanceHistory: [{
    activityId: { type: mongoose.Schema.Types.ObjectId, ref: "Activity" },
    marksObtained: { type: Number, default: 0 },
    marksTotal: { type: Number, default: 0 },
    date: { type: Date, default: Date.now },
    activityTitle: { type: String, default: "" }
  }],
  
  generatedFromActivities: { type: Boolean, default: false },
  
  averagePerformanceScore: { type: Number, default: 0 },
  
  lastActivityScore: { type: Number, default: 0 },
  lastActivityDate: { type: Date },
  
  performanceTrend: { 
    type: String, 
    enum: ["IMPROVING", "DECLINING", "STABLE", "NO_DATA"],
    default: "NO_DATA"
  },
  
  status: { 
    type: String, 
    enum: ["IDENTIFIED", "IN_PROGRESS", "IMPROVING", "RESOLVED"], 
    default: "IDENTIFIED" 
  },
  
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  recordedByName: { type: String },
  semester: { type: String, enum: ["TERM1", "TERM2", "TERM3"], required: true },
  academicYear: { type: Number, required: true },
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true }
}, { timestamps: true });

// Indexes
slowLearnerSchema.index({ student: 1, semester: 1, academicYear: 1 });
slowLearnerSchema.index({ school: 1, status: 1 });
slowLearnerSchema.index({ grade: 1, className: 1 });
slowLearnerSchema.index({ averagePerformanceScore: 1 });

module.exports = mongoose.model("SlowLearner", slowLearnerSchema);