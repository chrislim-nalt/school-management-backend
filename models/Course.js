const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema({
  courseCode: { type: String }, // no longer globally unique — see compound index + prefix below
  courseName: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  grade: {
    type: String,
    required: true,
    enum: [
      "Baby", "Middle", "Top", 
      "P1", "P2", "P3", "P4", "P5", "P6",
      "S1", "S2", "S3", "S4", "S5", "S6"
    ]
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
    const school = await School.findById(schoolId).select("schoolCode name code shortCode");
    // schoolCode is generated once at school creation and is already
    // enforced unique by the School schema itself — using it here means
    // two schools can NEVER collide on a prefix, even with near-identical
    // names like "Adonai High School" vs "Adonai Primary School (Birembo)"
    // vs "Adonai Primary School (Kami)", which name-derived letters cannot
    // tell apart (all three used to reduce to "ADON").
    const source = school?.schoolCode || school?.code || school?.shortCode || school?.name || "";
    const cleaned = source.toString().replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    return cleaned.slice(0, 10) || String(schoolId).slice(-6).toUpperCase();
  } catch {
    return String(schoolId).slice(-6).toUpperCase();
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