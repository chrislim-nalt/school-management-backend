const Attendance = require("../models/Attendance");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const Course = require("../models/Course");

// Helper: Check permissions
const hasPermission = (user, allowedTypes) => {
  if (user.role === "superadmin") return true;
  return allowedTypes.includes(user.userType);
};

// ==================== STUDENT ATTENDANCE ====================

// Get students by class for attendance marking
exports.getStudentsByClass = async (req, res) => {
  try {
    const { grade, className } = req.query;
    
    if (!grade || !className) {
      return res.status(400).json({ 
        success: false, 
        message: "Grade and class name are required" 
      });
    }
    
    // Check permission
    if (!hasPermission(req.user, ["school_admin", "teacher"])) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Only teachers and admins can view students." 
      });
    }
    
    const students = await Student.find({
      grade,
      className,
      school: req.user.schoolId,
      status: "ACTIVE",
      isDeleted: false
    }).select("name studentId grade className");
    
    res.json({
      success: true,
      students,
      classInfo: { grade, className, totalStudents: students.length }
    });
  } catch (error) {
    console.error("Get students by class error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Mark student attendance for a specific class
exports.markStudentAttendance = async (req, res) => {
  try {
    const { grade, className, date, period, records } = req.body;
    
    // Check permission
    if (!hasPermission(req.user, ["school_admin", "teacher"])) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Only teachers and admins can mark attendance." 
      });
    }
    
    if (!grade || !className || !records || records.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Grade, class, and attendance records are required" 
      });
    }
    
    const attendanceDate = date ? new Date(date) : new Date();
    attendanceDate.setHours(0, 0, 0, 0);
    
    const results = [];
    
    for (const record of records) {
      const existingAttendance = await Attendance.findOne({
        userId: record.studentId,
        userType: "STUDENT",
        date: attendanceDate,
        period: period || "MORNING",
        school: req.user.schoolId
      });
      
      const attendanceData = {
        userType: "STUDENT",
        userId: record.studentId,
        name: record.name,
        grade: grade,
        className: className,
        date: attendanceDate,
        status: record.status,
        reason: record.reason || "",
        period: period || "MORNING",
        recordedBy: req.user.id,
        recordedByName: req.user.name,
        school: req.user.schoolId
      };
      
      let result;
      if (existingAttendance) {
        result = await Attendance.findByIdAndUpdate(existingAttendance._id, attendanceData, { new: true });
      } else {
        result = await Attendance.create(attendanceData);
      }
      results.push(result);
    }
    
    res.status(201).json({
      success: true,
      message: `Attendance marked for ${results.length} students in ${grade} ${className}`,
      results
    });
  } catch (error) {
    console.error("Mark student attendance error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get student attendance by class and date
exports.getStudentAttendanceByClass = async (req, res) => {
  try {
    const { grade, className, date, period } = req.query;
    
    if (!grade || !className) {
      return res.status(400).json({ 
        success: false, 
        message: "Grade and class name are required" 
      });
    }
    
    const attendanceDate = date ? new Date(date) : new Date();
    attendanceDate.setHours(0, 0, 0, 0);
    
    const students = await Student.find({
      grade,
      className,
      school: req.user.schoolId,
      status: "ACTIVE",
      isDeleted: false
    });
    
    const attendanceRecords = await Attendance.find({
      userType: "STUDENT",
      grade,
      className,
      date: attendanceDate,
      period: period || "MORNING",
      school: req.user.schoolId
    });
    
    const attendanceMap = {};
    attendanceRecords.forEach(record => {
      attendanceMap[record.userId.toString()] = record;
    });
    
    const attendanceData = students.map(student => ({
      studentId: student._id,
      name: student.name,
      studentNumber: student.studentId,
      status: attendanceMap[student._id.toString()]?.status || "UNMARKED",
      reason: attendanceMap[student._id.toString()]?.reason || "",
      recordedAt: attendanceMap[student._id.toString()]?.updatedAt || null
    }));
    
    res.json({
      success: true,
      date: attendanceDate,
      grade,
      className,
      period: period || "MORNING",
      totalStudents: students.length,
      markedCount: attendanceRecords.length,
      attendance: attendanceData
    });
  } catch (error) {
    console.error("Get student attendance error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== TEACHER ATTENDANCE ====================

// Get all active teachers for attendance
exports.getTeachersForAttendance = async (req, res) => {
  try {
    // Check permission - only admins and customer care can mark teacher attendance
    if (!hasPermission(req.user, ["school_admin", "customer_care"])) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Only admins and customer care can mark teacher attendance." 
      });
    }
    
    const teachers = await Teacher.find({
      school: req.user.schoolId,
      status: "ACTIVE"
    }).select("name teacherId email phone");
    
    res.json({
      success: true,
      teachers,
      totalTeachers: teachers.length
    });
  } catch (error) {
    console.error("Get teachers for attendance error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Mark teacher attendance
exports.markTeacherAttendance = async (req, res) => {
  try {
    const { date, period, records } = req.body;
    
    // Check permission - only admins and customer care can mark teacher attendance
    if (!hasPermission(req.user, ["school_admin", "customer_care"])) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Only admins and customer care can mark teacher attendance." 
      });
    }
    
    if (!records || records.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Attendance records are required" 
      });
    }
    
    const attendanceDate = date ? new Date(date) : new Date();
    attendanceDate.setHours(0, 0, 0, 0);
    
    const results = [];
    
    for (const record of records) {
      const existingAttendance = await Attendance.findOne({
        userId: record.teacherId,
        userType: "TEACHER",
        date: attendanceDate,
        period: period || "DAILY",
        school: req.user.schoolId
      });
      
      const attendanceData = {
        userType: "TEACHER",
        userId: record.teacherId,
        name: record.name,
        date: attendanceDate,
        status: record.status,
        reason: record.reason || "",
        period: period || "DAILY",
        checkInTime: record.checkInTime || "",
        checkOutTime: record.checkOutTime || "",
        recordedBy: req.user.id,
        recordedByName: req.user.name,
        school: req.user.schoolId
      };
      
      let result;
      if (existingAttendance) {
        result = await Attendance.findByIdAndUpdate(existingAttendance._id, attendanceData, { new: true });
      } else {
        result = await Attendance.create(attendanceData);
      }
      results.push(result);
    }
    
    res.status(201).json({
      success: true,
      message: `Attendance marked for ${results.length} teachers`,
      results
    });
  } catch (error) {
    console.error("Mark teacher attendance error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get teacher attendance by date
exports.getTeacherAttendanceByDate = async (req, res) => {
  try {
    const { date, period } = req.query;
    
    // Check permission
    if (!hasPermission(req.user, ["school_admin", "customer_care"])) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied." 
      });
    }
    
    const attendanceDate = date ? new Date(date) : new Date();
    attendanceDate.setHours(0, 0, 0, 0);
    
    const teachers = await Teacher.find({
      school: req.user.schoolId,
      status: "ACTIVE"
    });
    
    const attendanceRecords = await Attendance.find({
      userType: "TEACHER",
      date: attendanceDate,
      period: period || "DAILY",
      school: req.user.schoolId
    });
    
    const attendanceMap = {};
    attendanceRecords.forEach(record => {
      attendanceMap[record.userId.toString()] = record;
    });
    
    const attendanceData = teachers.map(teacher => ({
      teacherId: teacher._id,
      name: teacher.name,
      teacherNumber: teacher.teacherId,
      email: teacher.email,
      status: attendanceMap[teacher._id.toString()]?.status || "UNMARKED",
      reason: attendanceMap[teacher._id.toString()]?.reason || "",
      checkInTime: attendanceMap[teacher._id.toString()]?.checkInTime || "",
      checkOutTime: attendanceMap[teacher._id.toString()]?.checkOutTime || ""
    }));
    
    res.json({
      success: true,
      date: attendanceDate,
      period: period || "DAILY",
      totalTeachers: teachers.length,
      markedCount: attendanceRecords.length,
      attendance: attendanceData
    });
  } catch (error) {
    console.error("Get teacher attendance error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== ATTENDANCE REPORTS ====================

// Get student attendance report (school-specific)
exports.getStudentAttendanceReport = async (req, res) => {
  try {
    const { grade, className, startDate, endDate, period } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        success: false, 
        message: "Start date and end date are required" 
      });
    }
    
    let filter = {
      userType: "STUDENT",
      school: req.user.schoolId,
      date: { $gte: new Date(startDate), $lte: new Date(endDate) }
    };
    
    if (grade) filter.grade = grade;
    if (className) filter.className = className;
    if (period) filter.period = period;
    
    const attendance = await Attendance.find(filter).sort({ date: 1 });
    
    // Group by student
    const studentStats = {};
    attendance.forEach(record => {
      const studentId = record.userId.toString();
      if (!studentStats[studentId]) {
        studentStats[studentId] = {
          name: record.name,
          grade: record.grade,
          className: record.className,
          present: 0,
          absent: 0,
          late: 0,
          total: 0
        };
      }
      studentStats[studentId][record.status.toLowerCase()]++;
      studentStats[studentId].total++;
    });
    
    // Daily breakdown
    const dailyBreakdown = {};
    attendance.forEach(record => {
      const dateStr = record.date.toISOString().split('T')[0];
      if (!dailyBreakdown[dateStr]) {
        dailyBreakdown[dateStr] = { present: 0, absent: 0, late: 0, total: 0 };
      }
      dailyBreakdown[dateStr][record.status.toLowerCase()]++;
      dailyBreakdown[dateStr].total++;
    });
    
    const summary = {
      schoolName: req.user.schoolName || "School",
      reportPeriod: { startDate, endDate },
      totalDays: Object.keys(dailyBreakdown).length,
      totalStudents: Object.keys(studentStats).length,
      overallAttendance: attendance.length > 0 
        ? ((attendance.filter(a => a.status !== "ABSENT").length / attendance.length) * 100).toFixed(1)
        : 0
    };
    
    res.json({
      success: true,
      summary,
      dailyBreakdown,
      studentPerformance: Object.values(studentStats),
      records: attendance
    });
  } catch (error) {
    console.error("Get student attendance report error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get teacher attendance report (school-specific)
exports.getTeacherAttendanceReport = async (req, res) => {
  try {
    const { startDate, endDate, period } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        success: false, 
        message: "Start date and end date are required" 
      });
    }
    
    let filter = {
      userType: "TEACHER",
      school: req.user.schoolId,
      date: { $gte: new Date(startDate), $lte: new Date(endDate) }
    };
    
    if (period) filter.period = period;
    
    const attendance = await Attendance.find(filter).sort({ date: 1 });
    
    // Group by teacher
    const teacherStats = {};
    attendance.forEach(record => {
      const teacherId = record.userId.toString();
      if (!teacherStats[teacherId]) {
        teacherStats[teacherId] = {
          name: record.name,
          present: 0,
          absent: 0,
          late: 0,
          total: 0
        };
      }
      teacherStats[teacherId][record.status.toLowerCase()]++;
      teacherStats[teacherId].total++;
    });
    
    // Daily breakdown
    const dailyBreakdown = {};
    attendance.forEach(record => {
      const dateStr = record.date.toISOString().split('T')[0];
      if (!dailyBreakdown[dateStr]) {
        dailyBreakdown[dateStr] = { present: 0, absent: 0, late: 0, total: 0 };
      }
      dailyBreakdown[dateStr][record.status.toLowerCase()]++;
      dailyBreakdown[dateStr].total++;
    });
    
    const summary = {
      schoolName: req.user.schoolName || "School",
      reportPeriod: { startDate, endDate },
      totalDays: Object.keys(dailyBreakdown).length,
      totalTeachers: Object.keys(teacherStats).length,
      overallAttendance: attendance.length > 0 
        ? ((attendance.filter(a => a.status !== "ABSENT").length / attendance.length) * 100).toFixed(1)
        : 0
    };
    
    res.json({
      success: true,
      summary,
      dailyBreakdown,
      teacherPerformance: Object.values(teacherStats),
      records: attendance
    });
  } catch (error) {
    console.error("Get teacher attendance report error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};