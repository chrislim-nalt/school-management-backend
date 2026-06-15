const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
  userType: { 
    type: String, 
    enum: ["TEACHER", "STUDENT"], 
    required: true 
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true, 
    refPath: 'userType' 
  },
  name: { type: String, required: true },
  // For students - class information
  grade: { type: String, default: "" },
  className: { type: String, default: "" },
  // For teachers - course/subject information
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", default: null },
  courseName: { type: String, default: "" },
  date: { type: Date, required: true },
  status: { 
    type: String, 
    enum: ["PRESENT", "ABSENT", "LATE"], 
    default: "PRESENT" 
  },
  checkInTime: { type: String, default: "" },
  checkOutTime: { type: String, default: "" },
  reason: { type: String, default: "" },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  recordedByName: { type: String, default: "" },
  period: { type: String, default: "" }, // Morning, Afternoon, etc.
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true }
}, { timestamps: true });

// Compound index to prevent duplicate attendance records
attendanceSchema.index({ userId: 1, date: 1, userType: 1, period: 1 }, { unique: true });
attendanceSchema.index({ school: 1, date: 1, grade: 1, className: 1 });

module.exports = mongoose.model("Attendance", attendanceSchema);