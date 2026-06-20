const mongoose = require("mongoose");

const transportRecordSchema = new mongoose.Schema({
  date: { type: Date, required: true, default: Date.now },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  studentName: { type: String, required: true },
  studentId: { type: String, required: true },
  grade: { type: String, required: true },
  className: { type: String, required: true },
  pickupLocation: { type: String, default: "" },
  dropoffLocation: { type: String, default: "" },
  distance: { type: Number, default: 0 },
  status: { type: String, enum: ["COMPLETED", "ABSENT", "HOLIDAY", "CANCELLED"], default: "COMPLETED" },
  notes: { type: String, default: "" },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  recordedByName: { type: String, default: "" },
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true }
}, { timestamps: true });

// Ensure we don't have duplicate records per day per student
transportRecordSchema.index({ date: 1, student: 1, school: 1 }, { unique: true });
transportRecordSchema.index({ school: 1, date: 1 });
transportRecordSchema.index({ school: 1, grade: 1, className: 1 });
transportRecordSchema.index({ student: 1, school: 1 });

module.exports = mongoose.model("TransportRecord", transportRecordSchema);