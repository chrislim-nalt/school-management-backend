const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema({
  // Class level
  grade: { type: String, required: true },
  className: { type: String, required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  courseName: { type: String, required: true },
  activityType: { 
    type: String, 
    enum: ["EXERCISE", "QUIZ", "HOMEWORK", "EXAM"], 
    required: true 
  },
  title: { type: String, required: true },
  description: { type: String, default: "" },
  maxScore: { type: Number, default: 100, min: 1 },
  
  // Student level
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  studentName: { type: String, required: true },
  studentId: { type: String, required: true },
  score: { type: Number, default: 0, min: 0 },
  percentage: { type: Number, default: 0 },
  
  // ===== NEW FIELDS FOR MARKS TRACKING =====
  marksObtained: { type: Number, default: 0 },
  marksTotal: { type: Number, default: 0 },
  
  // ===== NEW FIELDS FOR SLOW LEARNER TRACKING =====
  isSlowLearnerActivity: { type: Boolean, default: false },
  slowLearnerCaseId: { type: mongoose.Schema.Types.ObjectId, ref: "SlowLearner" },
  
  // ===== NEW FIELD FOR PERFORMANCE CLASSIFICATION =====
  performanceLevel: { 
    type: String, 
    enum: ["EXCELLENT", "GOOD", "AVERAGE", "POOR", "FAILING"],
    default: "AVERAGE"
  },
  
  // Metadata
  date: { type: Date, default: Date.now },
  term: { type: String, enum: ["TERM1", "TERM2", "TERM3"], required: true },
  academicYear: { type: Number, required: true },
  semester: { type: String, enum: ["TERM1", "TERM2", "TERM3"], required: true },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  recordedByName: { type: String, default: "" },
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
  
  // Track if this is part of a batch assignment
  batchId: { type: String, default: null }
}, { timestamps: true });

// Indexes for performance
activitySchema.index({ grade: 1, className: 1, course: 1, activityType: 1 });
activitySchema.index({ student: 1, term: 1, academicYear: 1 });
activitySchema.index({ batchId: 1 });
activitySchema.index({ school: 1, grade: 1, className: 1 });
activitySchema.index({ date: -1 });
activitySchema.index({ performanceLevel: 1 });
activitySchema.index({ isSlowLearnerActivity: 1 });
activitySchema.index({ marksObtained: 1, marksTotal: 1 });

module.exports = mongoose.model("Activity", activitySchema);