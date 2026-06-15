const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  studentName: { type: String, required: true },
  studentId: { type: String, required: true },
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
  description: { type: String },
  score: { type: Number, required: true, min: 0, max: 100 },
  maxScore: { type: Number, default: 100 },
  percentage: { type: Number, default: 0 },
  date: { type: Date, default: Date.now },
  term: { type: String, enum: ["TERM1", "TERM2", "TERM3"], required: true },
  academicYear: { type: Number, required: true },
  semester: { type: String, enum: ["TERM1", "TERM2", "TERM3"], required: true },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  recordedByName: { type: String },
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true }
}, { timestamps: true });

// Calculate percentage before save
activitySchema.pre('save', function(next) {
  this.percentage = (this.score / this.maxScore) * 100;
  next();
});

// Index for performance tracking
activitySchema.index({ student: 1, term: 1, academicYear: 1 });
activitySchema.index({ grade: 1, className: 1, course: 1, activityType: 1 });

module.exports = mongoose.model("Activity", activitySchema);