const mongoose = require("mongoose");

const disciplineSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  studentName: { type: String, required: true },
  studentId: { type: String, required: true },
  grade: { type: String, required: true },
  className: { type: String, required: true },
  // Conduct score (default 40 per semester)
  conductScore: { type: Number, default: 40, min: 0, max: 40 },
  // Individual offense records
  offenses: [{
    offenseType: { type: String, enum: ["MISCONDUCT", "LATE_COMING", "FIGHTING", "DISRESPECT", "OTHER"] },
    description: { type: String },
    pointsDeducted: { type: Number, default: 0 },
    date: { type: Date, default: Date.now },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    recordedByName: { type: String },
    semester: { type: String, enum: ["TERM1", "TERM2", "TERM3"] }
  }],
  semester: { type: String, enum: ["TERM1", "TERM2", "TERM3"], required: true },
  academicYear: { type: Number, required: true },
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true }
}, { timestamps: true });

// Update conduct score when offense is added
disciplineSchema.methods.updateConductScore = function() {
  let totalDeduction = 0;
  this.offenses.forEach(offense => {
    totalDeduction += offense.pointsDeducted;
  });
  this.conductScore = Math.max(0, 40 - totalDeduction);
  return this.conductScore;
};

module.exports = mongoose.model("Discipline", disciplineSchema);