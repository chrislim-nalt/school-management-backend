const mongoose = require("mongoose");

const teacherSchema = new mongoose.Schema({
  teacherId: { type: String }, // no longer globally unique — see compound index below
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, default: "" },
  address: { type: String, default: "" },
  subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }],
  hireDate: { type: Date, default: Date.now },
  qualification: { type: String, default: "" },
  specialization: { type: String, default: "" },
  status: { type: String, enum: ["ACTIVE", "INACTIVE", "ON_LEAVE"], default: "ACTIVE" },
  permissions: {
    canAddMarks: { type: Boolean, default: true },
    canManageAttendance: { type: Boolean, default: true },
    canViewReports: { type: Boolean, default: true }
  },
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true }
}, { timestamps: true });

// Uniqueness is scoped PER SCHOOL, not global.
// This lets every school independently have a TCH-0001, TCH-0002, etc.
teacherSchema.index({ school: 1, teacherId: 1 }, { unique: true });
teacherSchema.index({ school: 1, email: 1 }, { unique: true });

// Static method to generate teacher ID
teacherSchema.statics.generateTeacherId = async function(schoolId) {
  const Teacher = this;
  const lastTeacher = await Teacher.findOne({
    school: schoolId
  }).sort({ createdAt: -1 }).limit(1);

  let lastId = 0;
  if (lastTeacher && lastTeacher.teacherId) {
    const match = lastTeacher.teacherId.match(/\d+/);
    if (match) lastId = parseInt(match[0]);
  }
  return `TCH-${String(lastId + 1).padStart(4, '0')}`;
};

module.exports = mongoose.model("Teacher", teacherSchema);