const mongoose = require("mongoose");

const teacherSchema = new mongoose.Schema({
  teacherId: { type: String }, // no longer globally unique — see compound index + prefix below
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

// Belt-and-suspenders: even though prefixed IDs are already unique per school,
// this compound index guarantees it at the DB level too.
teacherSchema.index({ school: 1, teacherId: 1 }, { unique: true });
teacherSchema.index({ school: 1, email: 1 }, { unique: true });
async function getSchoolPrefix(schoolId) {
  try {
    const School = mongoose.model("School");
    const school = await School.findById(schoolId).select("name code shortCode schoolCode");
    const source =
      school?.code || school?.shortCode || school?.schoolCode || school?.name || "";
    const cleaned = source.toString().replace(/[^a-zA-Z]/g, "").toUpperCase();
    return cleaned.slice(0, 4) || String(schoolId).slice(-4).toUpperCase();
  } catch {
    return String(schoolId).slice(-4).toUpperCase();
  }
}

// Static method to generate teacher ID, now prefixed per school
teacherSchema.statics.generateTeacherId = async function (schoolId) {
  const Teacher = this;
  const prefix = await getSchoolPrefix(schoolId);

  const lastTeacher = await Teacher.findOne({ school: schoolId })
    .sort({ createdAt: -1 })
    .limit(1);

  let lastNum = 0;
  if (lastTeacher && lastTeacher.teacherId) {
    const match = lastTeacher.teacherId.match(/(\d+)$/); // trailing number, prefix-agnostic
    if (match) lastNum = parseInt(match[1]);
  }

  return `${prefix}-TCH-${String(lastNum + 1).padStart(4, "0")}`;
};

module.exports = mongoose.model("Teacher", teacherSchema);