const mongoose = require("mongoose");

const homeworkSchema = new mongoose.Schema({
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
  teacherName: { type: String, required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
  courseName: { type: String, required: true },
  grade: { type: String, required: true },
  className: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  dueDate: { type: Date, required: true },
  assignedDate: { type: Date, default: Date.now },
  attachments: [{ type: String }], // URLs to files
  // Student submissions
  submissions: [{
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
    studentName: { type: String },
    submittedAt: { type: Date },
    score: { type: Number, min: 0, max: 100 },
    feedback: { type: String },
    status: { type: String, enum: ["PENDING", "SUBMITTED", "GRADED"], default: "PENDING" }
  }],
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true }
}, { timestamps: true });

// Index for reporting
homeworkSchema.index({ assignedDate: 1, grade: 1, className: 1 });
homeworkSchema.index({ teacher: 1, assignedDate: -1 });

module.exports = mongoose.model("Homework", homeworkSchema);