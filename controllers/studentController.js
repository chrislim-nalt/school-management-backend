const Student = require("../models/Student");
const Mark = require("../models/Mark");
const Attendance = require("../models/Attendance");

// ==================== GET STUDENTS ====================

// Get all students
exports.getStudents = async (req, res) => {
  try {
    const { grade, className, status, search } = req.query;
    let filter = { school: req.user.schoolId, isDeleted: false };
    
    if (grade) filter.grade = grade;
    if (className) filter.className = className;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { studentId: { $regex: search, $options: 'i' } },
        { parentPhone: { $regex: search, $options: 'i' } }
      ];
    }
    
    const students = await Student.find(filter).sort({ name: 1 });
    res.json({
      success: true,
      students: students || [],
      count: (students || []).length
    });
  } catch (error) {
    console.error("Get students error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message,
      students: [],
      count: 0
    });
  }
};

// Get single student
exports.getStudentById = async (req, res) => {
  try {
    const student = await Student.findOne({ 
      _id: req.params.id, 
      school: req.user.schoolId,
      isDeleted: false
    });
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });
    res.json({ success: true, student });
  } catch (error) {
    console.error("Get student error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get students by class
exports.getStudentsByClass = async (req, res) => {
  try {
    const { grade, className } = req.query;
    
    if (!grade || !className) {
      return res.status(400).json({ 
        success: false, 
        message: "Grade and class name are required" 
      });
    }
    
    const schoolId = req.user.schoolId;
    
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: "School ID not found for this user"
      });
    }
    
    const students = await Student.find({
      grade,
      className,
      school: schoolId,
      status: "ACTIVE",
      isDeleted: false
    }).select("name studentId grade className gender parentPhone status");
    
    res.json({
      success: true,
      students: students || [],
      count: (students || []).length
    });
  } catch (error) {
    console.error("Get students by class error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message,
      students: [],
      count: 0
    });
  }
};

// Create student - Generate ID in controller
exports.createStudent = async (req, res) => {
  try {
    console.log("=== CREATE STUDENT ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    
    // Validate required fields
    if (!req.body.name) {
      return res.status(400).json({ 
        success: false, 
        message: "Student name is required" 
      });
    }
    if (!req.body.grade) {
      return res.status(400).json({ 
        success: false, 
        message: "Grade is required" 
      });
    }
    if (!req.body.className) {
      return res.status(400).json({ 
        success: false, 
        message: "Class name is required" 
      });
    }
    
    // Check for duplicate student
    const existingStudent = await Student.findOne({
      name: req.body.name.trim(),
      grade: req.body.grade,
      className: req.body.className,
      school: req.user.schoolId,
      isDeleted: false
    });
    
    if (existingStudent) {
      return res.status(400).json({
        success: false,
        message: `Student "${req.body.name}" already exists in ${req.body.grade} ${req.body.className}`
      });
    }
    
    // GENERATE STUDENT ID IN CONTROLLER (not in model)
    const studentId = await Student.generateStudentId(req.user.schoolId);
    console.log("Generated student ID:", studentId);
    
    // Create student data WITH the generated studentId
    const studentData = {
      studentId: studentId, // Set the generated ID
      name: req.body.name.trim(),
      grade: req.body.grade,
      className: req.body.className,
      school: req.user.schoolId,
      dateOfBirth: req.body.dateOfBirth || null,
      gender: req.body.gender || "MALE",
      address: req.body.address || "",
      parentName: req.body.parentName || "",
      parentPhone: req.body.parentPhone || "",
      parentEmail: req.body.parentEmail || "",
      parentOccupation: req.body.parentOccupation || "",
      parentAddress: req.body.parentAddress || "",
      emergencyContact: req.body.emergencyContact || "",
      emergencyContactPhone: req.body.emergencyContactPhone || "",
      emergencyRelationship: req.body.emergencyRelationship || "",
      medicalInfo: req.body.medicalInfo || "",
      allergies: req.body.allergies || "",
      bloodGroup: req.body.bloodGroup || "",
      previousSchool: req.body.previousSchool || "",
      transportSubscribed: req.body.transportSubscribed || false,
      transportRoute: req.body.transportRoute || "",
      transportPickupPoint: req.body.transportPickupPoint || "",
      transportDropoffPoint: req.body.transportDropoffPoint || "",
      status: req.body.status || "ACTIVE"
    };
    
    console.log("Creating student with data:", studentData);
    
    const student = new Student(studentData);
    const savedStudent = await student.save();
    
    console.log("Student created successfully:", {
      id: savedStudent._id,
      studentId: savedStudent.studentId,
      name: savedStudent.name
    });
    
    res.status(201).json({
      success: true,
      message: "Student created successfully",
      student: savedStudent
    });
  } catch (error) {
    console.error("Create student error:", error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "A student with this ID already exists. Please try again."
      });
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        success: false,
        message: "Validation failed", 
        errors: validationErrors
      });
    }
    
    res.status(400).json({ 
      success: false, 
      message: error.message || "Failed to create student"
    });
  }
};

// Update student
exports.updateStudent = async (req, res) => {
  try {
    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.studentId;
    delete updateData.school;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    
    const student = await Student.findOneAndUpdate(
      { _id: req.params.id, school: req.user.schoolId, isDeleted: false },
      updateData,
      { new: true, runValidators: true }
    );
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });
    res.json({
      success: true,
      message: "Student updated successfully",
      student: student
    });
  } catch (error) {
    console.error("Update student error:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// Delete student
exports.deleteStudent = async (req, res) => {
  try {
    const student = await Student.findOneAndUpdate(
      { _id: req.params.id, school: req.user.schoolId },
      { isDeleted: true, deletedAt: new Date(), deletedBy: req.user.id },
      { new: true }
    );
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });
    res.json({ 
      success: true,
      message: "Student deleted successfully" 
    });
  } catch (error) {
    console.error("Delete student error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get student performance
exports.getStudentPerformance = async (req, res) => {
  try {
    const { term, year } = req.query;
    const studentId = req.params.id;
    
    const marks = await Mark.find({
      student: studentId,
      term,
      year: parseInt(year),
      school: req.user.schoolId
    }).populate("course", "courseName courseCode coefficient");
    
    const totalMarks = marks.reduce((sum, m) => sum + m.totalScore, 0);
    const average = marks.length > 0 ? (totalMarks / marks.length).toFixed(1) : 0;
    
    const gradeDistribution = {
      A: marks.filter(m => m.grade === "A").length,
      B: marks.filter(m => m.grade === "B").length,
      C: marks.filter(m => m.grade === "C").length,
      D: marks.filter(m => m.grade === "D").length,
      F: marks.filter(m => m.grade === "F").length
    };
    
    res.json({
      success: true,
      studentId,
      marks,
      average,
      totalMarks,
      gradeDistribution,
      subjectsCount: marks.length
    });
  } catch (error) {
    console.error("Get student performance error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get student attendance
exports.getStudentAttendance = async (req, res) => {
  try {
    const { period = "month" } = req.query;
    const studentId = req.params.id;
    
    let startDate = new Date();
    if (period === "week") {
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === "month") {
      startDate.setMonth(startDate.getMonth() - 1);
    } else {
      startDate.setDate(startDate.getDate() - 30);
    }
    
    const attendance = await Attendance.find({
      userId: studentId,
      userType: "STUDENT",
      date: { $gte: startDate },
      school: req.user.schoolId
    });
    
    const total = attendance.length;
    const present = attendance.filter(a => a.status === "PRESENT").length;
    const absent = attendance.filter(a => a.status === "ABSENT").length;
    const late = attendance.filter(a => a.status === "LATE").length;
    
    res.json({
      success: true,
      total,
      present,
      absent,
      late,
      attendanceRate: total > 0 ? ((present + late) / total * 100).toFixed(1) : 0,
      records: attendance
    });
  } catch (error) {
    console.error("Get student attendance error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};