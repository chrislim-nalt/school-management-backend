const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema({
  courseCode: { type: String, unique: true },
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

// Static method to generate course code
courseSchema.statics.generateCourseCode = async function(schoolId) {
  const Course = this;
  const lastCourse = await Course.findOne({ 
    school: schoolId
  }).sort({ courseCode: -1 }).limit(1);
  
  let lastId = 0;
  if (lastCourse && lastCourse.courseCode) {
    const match = lastCourse.courseCode.match(/\d+/);
    if (match) lastId = parseInt(match[0]);
  }
  return `CRS-${String(lastId + 1).padStart(4, '0')}`;
};

// Indexes for performance
courseSchema.index({ school: 1, grade: 1 });
courseSchema.index({ teacher: 1, school: 1 });

module.exports = mongoose.model("Course", courseSchema);