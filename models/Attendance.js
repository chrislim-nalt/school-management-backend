const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
  // User information
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  userName: { type: String, required: true },
  userType: { type: String, enum: ["STUDENT", "TEACHER"], required: true },
  userIdentifier: { type: String, default: "" }, // studentId or teacherId
  
  // For students
  grade: { type: String, default: "" },
  className: { type: String, default: "" },
  
  // Attendance details
  status: { 
    type: String, 
    enum: ["PRESENT", "ABSENT", "LATE", "UNMARKED"], 
    default: "UNMARKED" 
  },
  reason: { type: String, default: "" },
  
  // For teachers
  checkInTime: { type: String, default: "" },
  checkOutTime: { type: String, default: "" },
  
  // Date and period
  date: { type: Date, required: true, default: Date.now },
  period: { type: String, enum: ["DAILY", "MORNING", "AFTERNOON"], default: "DAILY" },
  
  // Recorded by
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  recordedByName: { type: String, default: "" },
  
  // School
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true }
}, { timestamps: true });

// Indexes for performance
attendanceSchema.index({ userId: 1, date: 1, period: 1 });
attendanceSchema.index({ school: 1, date: 1, userType: 1 });
attendanceSchema.index({ grade: 1, className: 1, date: 1 });
attendanceSchema.index({ userType: 1, date: 1 });

// NO PRE-SAVE HOOKS - Keep it simple

module.exports = mongoose.model("Attendance", attendanceSchema);