const mongoose = require("mongoose");

const englishPerformanceSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  studentName: { type: String, required: true },
  studentId: { type: String, required: true },
  grade: { type: String, required: true },
  className: { type: String, required: true },
  // Violation records (speaking Kinyarwanda)
  violations: [{
    date: { type: Date, default: Date.now },
    location: { type: String, enum: ["CLASSROOM", "HALL", "PLAYGROUND", "DORMITORY", "OTHER"] },
    context: { type: String }, // What was being said
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    recordedByName: { type: String },
    actionTaken: { type: String }, // Red card, warning, etc.
    semester: { type: String, enum: ["TERM1", "TERM2", "TERM3"] }
  }],
  // Weekly performance tracking
  weeklyStats: [{
    week: { type: Number }, // Week number of the year
    year: { type: Number },
    violationCount: { type: Number, default: 0 },
    improvement: { type: Number, default: 0 } // -1 = worse, 0 = same, 1 = better
  }],
  semester: { type: String, enum: ["TERM1", "TERM2", "TERM3"], required: true },
  academicYear: { type: Number, required: true },
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true }
}, { timestamps: true });

// Index for efficient queries
englishPerformanceSchema.index({ student: 1, semester: 1, academicYear: 1 }, { unique: true });
englishPerformanceSchema.index({ grade: 1, className: 1 });

module.exports = mongoose.model("EnglishPerformance", englishPerformanceSchema);