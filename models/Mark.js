const mongoose = require("mongoose");

const markSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  term: { type: String, enum: ["TERM1", "TERM2", "TERM3"], required: true },
  year: { type: Number, required: true },
  continuousAssessment: { type: Number, min: 0, max: 40, default: 0 },
  examScore: { type: Number, min: 0, max: 60, default: 0 },
  totalScore: { type: Number, min: 0, max: 100, default: 0 },
  grade: { type: String, enum: ["A", "B", "C", "D", "F"], default: "F" },
  remarks: { type: String, default: "" },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher" },
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true }
}, { timestamps: true });

// Pre-save middleware is fine for marks (no ID generation needed)
markSchema.pre('save', function(next) {
  this.totalScore = (this.continuousAssessment || 0) + (this.examScore || 0);
  
  if (this.totalScore >= 80) this.grade = "A";
  else if (this.totalScore >= 70) this.grade = "B";
  else if (this.totalScore >= 60) this.grade = "C";
  else if (this.totalScore >= 50) this.grade = "D";
  else this.grade = "F";
  
  next();
});

module.exports = mongoose.model("Mark", markSchema);