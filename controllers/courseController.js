const Course = require("../models/Course");

// Get all courses
exports.getCourses = async (req, res) => {
  try {
    const { grade } = req.query;
    let filter = { school: req.user.schoolId };
    
    if (grade) filter.grade = grade;
    
    const courses = await Course.find(filter)
      .populate("teacher", "name teacherId")
      .sort({ courseName: 1 });
    
    res.json(courses);
  } catch (error) {
    console.error("Get courses error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get course by ID
exports.getCourseById = async (req, res) => {
  try {
    const course = await Course.findOne({
      _id: req.params.id,
      school: req.user.schoolId
    }).populate("teacher", "name teacherId email");
    
    if (!course) return res.status(404).json({ message: "Course not found" });
    res.json(course);
  } catch (error) {
    console.error("Get course error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Create course
exports.createCourse = async (req, res) => {
  try {
    console.log("Creating course with data:", req.body);
    
    // Validate required fields
    if (!req.body.courseName) {
      return res.status(400).json({ message: "Course name is required" });
    }
    if (!req.body.grade) {
      return res.status(400).json({ message: "Grade is required" });
    }
    
    // Generate course code
    const courseCode = await Course.generateCourseCode(req.user.schoolId);
    console.log("Generated course code:", courseCode);
    
    const courseData = {
      courseCode: courseCode,
      courseName: req.body.courseName.trim(),
      description: req.body.description || "",
      grade: req.body.grade,
      coefficient: req.body.coefficient || 1,
      teacher: req.body.teacher || null,
      school: req.user.schoolId
    };
    
    const course = new Course(courseData);
    const savedCourse = await course.save();
    
    console.log("Course created successfully:", savedCourse.courseCode);
    res.status(201).json({
      success: true,
      message: "Course created successfully",
      course: savedCourse
    });
  } catch (error) {
    console.error("Create course error:", error);
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        message: "Validation failed", 
        errors: validationErrors,
        details: error.message
      });
    }
    res.status(400).json({ message: error.message });
  }
};

// Update course
exports.updateCourse = async (req, res) => {
  try {
    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.courseCode;
    delete updateData.school;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    
    const course = await Course.findOneAndUpdate(
      { _id: req.params.id, school: req.user.schoolId },
      updateData,
      { new: true }
    );
    if (!course) return res.status(404).json({ message: "Course not found" });
    
    res.json({
      success: true,
      message: "Course updated successfully",
      course: course
    });
  } catch (error) {
    console.error("Update course error:", error);
    res.status(400).json({ message: error.message });
  }
};

// Delete course
exports.deleteCourse = async (req, res) => {
  try {
    const course = await Course.findOneAndDelete({
      _id: req.params.id,
      school: req.user.schoolId
    });
    if (!course) return res.status(404).json({ message: "Course not found" });
    res.json({ 
      success: true,
      message: "Course deleted successfully" 
    });
  } catch (error) {
    console.error("Delete course error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get courses by grade
exports.getCoursesByGrade = async (req, res) => {
  try {
    const courses = await Course.find({
      grade: req.params.grade,
      school: req.user.schoolId
    }).populate("teacher", "name");
    
    res.json(courses);
  } catch (error) {
    console.error("Get courses by grade error:", error);
    res.status(500).json({ message: error.message });
  }
};