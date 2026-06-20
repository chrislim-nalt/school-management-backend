const Course = require("../models/Course");
const Teacher = require("../models/Teacher");

// Get all courses
exports.getCourses = async (req, res) => {
  try {
    const { grade, teacher } = req.query;
    let filter = { school: req.user.schoolId };
    
    if (grade) filter.grade = grade;
    if (teacher) filter.teacher = teacher;
    
    const courses = await Course.find(filter)
      .populate("teacher", "name email teacherId qualification status")
      .sort({ courseName: 1 });
    
    console.log(`Found ${courses.length} courses for school ${req.user.schoolId}`);
    console.log("Courses data:", JSON.stringify(courses.map(c => ({ id: c._id, name: c.courseName, grade: c.grade })), null, 2));
    
    // Return in a consistent format with courses array
    res.json({
      success: true,
      courses: courses || [],
      count: (courses || []).length
    });
  } catch (error) {
    console.error("Get courses error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message,
      courses: [],
      count: 0
    });
  }
};

// Get single course
exports.getCourseById = async (req, res) => {
  try {
    const course = await Course.findOne({
      _id: req.params.id,
      school: req.user.schoolId
    }).populate("teacher", "name email teacherId qualification status");
    
    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }
    
    res.json({
      success: true,
      course
    });
  } catch (error) {
    console.error("Get course error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create course
exports.createCourse = async (req, res) => {
  try {
    const { courseName, description, grade, coefficient, teacher } = req.body;
    
    if (!courseName || !grade) {
      return res.status(400).json({
        success: false,
        message: "Course name and grade are required"
      });
    }
    
    // Generate course code
    const courseCode = await Course.generateCourseCode(req.user.schoolId);
    
    // If teacher is provided, verify it exists
    let teacherData = null;
    if (teacher) {
      teacherData = await Teacher.findOne({ _id: teacher, school: req.user.schoolId });
      if (!teacherData) {
        return res.status(404).json({
          success: false,
          message: "Teacher not found"
        });
      }
    }
    
    const course = new Course({
      courseCode,
      courseName: courseName.trim(),
      description: description || "",
      grade,
      coefficient: coefficient || 1,
      teacher: teacher || null,
      school: req.user.schoolId
    });
    
    await course.save();
    
    // Populate teacher data before returning
    await course.populate("teacher", "name email teacherId qualification status");
    
    res.status(201).json({
      success: true,
      message: "Course created successfully",
      course
    });
  } catch (error) {
    console.error("Create course error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update course
exports.updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.courseCode;
    delete updateData.school;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    
    if (updateData.teacher) {
      const teacherData = await Teacher.findOne({ 
        _id: updateData.teacher, 
        school: req.user.schoolId 
      });
      if (!teacherData) {
        return res.status(404).json({
          success: false,
          message: "Teacher not found"
        });
      }
    }
    
    const course = await Course.findOneAndUpdate(
      { _id: id, school: req.user.schoolId },
      updateData,
      { new: true, runValidators: true }
    ).populate("teacher", "name email teacherId qualification status");
    
    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }
    
    res.json({
      success: true,
      message: "Course updated successfully",
      course
    });
  } catch (error) {
    console.error("Update course error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete course
exports.deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;
    
    const course = await Course.findOneAndDelete({
      _id: id,
      school: req.user.schoolId
    });
    
    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }
    
    res.json({
      success: true,
      message: "Course deleted successfully"
    });
  } catch (error) {
    console.error("Delete course error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get courses by grade
exports.getCoursesByGrade = async (req, res) => {
  try {
    const { grade } = req.params;
    
    const courses = await Course.find({
      grade,
      school: req.user.schoolId
    }).populate("teacher", "name email teacherId");
    
    res.json({
      success: true,
      courses: courses || []
    });
  } catch (error) {
    console.error("Get courses by grade error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};