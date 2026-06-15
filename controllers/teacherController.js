const Teacher = require("../models/Teacher");

// Get all teachers
exports.getTeachers = async (req, res) => {
  try {
    const teachers = await Teacher.find({ school: req.user.schoolId })
      .populate("subjects", "courseName courseCode")
      .sort({ createdAt: -1 });
    res.json(teachers);
  } catch (error) {
    console.error("Get teachers error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get single teacher
exports.getTeacherById = async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ 
      _id: req.params.id, 
      school: req.user.schoolId 
    }).populate("subjects", "courseName courseCode");
    
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });
    res.json(teacher);
  } catch (error) {
    console.error("Get teacher error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Create teacher
exports.createTeacher = async (req, res) => {
  try {
    console.log("Creating teacher with data:", req.body);
    
    // Validate required fields
    if (!req.body.name) {
      return res.status(400).json({ message: "Teacher name is required" });
    }
    if (!req.body.email) {
      return res.status(400).json({ message: "Email is required" });
    }
    
    // Check if teacher with same email exists
    const existingTeacher = await Teacher.findOne({ 
      email: req.body.email.toLowerCase(),
      school: req.user.schoolId 
    });
    
    if (existingTeacher) {
      return res.status(400).json({ message: "Teacher with this email already exists" });
    }
    
    // Generate teacher ID
    const teacherId = await Teacher.generateTeacherId(req.user.schoolId);
    console.log("Generated teacher ID:", teacherId);
    
    const teacherData = {
      teacherId: teacherId,
      name: req.body.name.trim(),
      email: req.body.email.toLowerCase().trim(),
      phone: req.body.phone || "",
      address: req.body.address || "",
      qualification: req.body.qualification || "",
      specialization: req.body.specialization || "",
      hireDate: req.body.hireDate || new Date(),
      status: req.body.status || "ACTIVE",
      permissions: {
        canAddMarks: req.body.permissions?.canAddMarks !== false,
        canManageAttendance: req.body.permissions?.canManageAttendance !== false,
        canViewReports: req.body.permissions?.canViewReports !== false
      },
      school: req.user.schoolId
    };
    
    const teacher = new Teacher(teacherData);
    const savedTeacher = await teacher.save();
    
    console.log("Teacher created successfully:", savedTeacher.teacherId);
    res.status(201).json({
      success: true,
      message: "Teacher created successfully",
      teacher: savedTeacher
    });
  } catch (error) {
    console.error("Create teacher error:", error);
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

// Update teacher
exports.updateTeacher = async (req, res) => {
  try {
    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.teacherId;
    delete updateData.school;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    
    const teacher = await Teacher.findOneAndUpdate(
      { _id: req.params.id, school: req.user.schoolId },
      updateData,
      { new: true, runValidators: true }
    );
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });
    
    res.json({
      success: true,
      message: "Teacher updated successfully",
      teacher: teacher
    });
  } catch (error) {
    console.error("Update teacher error:", error);
    res.status(400).json({ message: error.message });
  }
};

// Delete teacher
exports.deleteTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.findOneAndDelete({ 
      _id: req.params.id, 
      school: req.user.schoolId 
    });
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });
    res.json({ 
      success: true,
      message: "Teacher deleted successfully" 
    });
  } catch (error) {
    console.error("Delete teacher error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get teacher attendance statistics
exports.getTeacherAttendanceStats = async (req, res) => {
  try {
    const { period = "month" } = req.query;
    const today = new Date();
    let startDate;
    
    if (period === "week") {
      startDate = new Date(today.setDate(today.getDate() - 7));
    } else if (period === "month") {
      startDate = new Date(today.setMonth(today.getMonth() - 1));
    } else {
      startDate = new Date(today.setDate(today.getDate() - 30));
    }
    
    const attendance = await Attendance.find({
      userType: "TEACHER",
      date: { $gte: startDate },
      school: req.user.schoolId
    });
    
    const total = attendance.length;
    const present = attendance.filter(a => a.status === "PRESENT").length;
    const absent = attendance.filter(a => a.status === "ABSENT").length;
    const late = attendance.filter(a => a.status === "LATE").length;
    
    res.json({
      total,
      present,
      absent,
      late,
      attendanceRate: total > 0 ? ((present + late) / total * 100).toFixed(1) : 0
    });
  } catch (error) {
    console.error("Get teacher attendance stats error:", error);
    res.status(500).json({ message: error.message });
  }
};