const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema({
  courseCode: { type: String }, // no longer globally unique — see compound index + prefix below
  courseName: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  grade: {
    type: String,
    required: true,
    enum: ["P1", "P2", "P3", "P4", "P5", "P6", "S1", "S2", "S3", "S4", "S5", "S6"]
  },
  coefficient: { type: Number, default: 1, min: 0.5 },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", default: null },
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true }
}, { timestamps: true });

/**
 * Same prefix strategy as Teacher.js / Student.js.
 */
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

// Static method to generate course code, now prefixed per school
courseSchema.statics.generateCourseCode = async function (schoolId) {
  const Course = this;
  const prefix = await getSchoolPrefix(schoolId);

  const lastCourse = await Course.findOne({ school: schoolId })
    .sort({ createdAt: -1 })
    .limit(1);

  let lastId = 0;
  if (lastCourse && lastCourse.courseCode) {
    const match = lastCourse.courseCode.match(/(\d+)$/); // trailing number, prefix-agnostic
    if (match) lastId = parseInt(match[1]);
  }
  return `${prefix}-CRS-${String(lastId + 1).padStart(4, '0')}`;
};

// Indexes for performance + uniqueness (per school, backed up by prefixed codes)
courseSchema.index({ school: 1, courseCode: 1 }, { unique: true });
courseSchema.index({ school: 1, grade: 1 });
courseSchema.index({ teacher: 1, school: 1 });

module.exports = mongoose.model("Course", courseSchema);