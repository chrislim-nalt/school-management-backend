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
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true }
}, { timestamps: true });

// NO PRE-SAVE HOOK - Calculate in the controller instead
// This avoids the "next is not a function" error

// Indexes
markSchema.index({ student: 1, course: 1, term: 1, year: 1 });
markSchema.index({ school: 1, term: 1, year: 1 });
markSchema.index({ grade: 1 });

module.exports = mongoose.model("Mark", markSchema);