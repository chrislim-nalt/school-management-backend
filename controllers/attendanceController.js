const Attendance = require("../models/Attendance");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");

// ==================== STUDENT ATTENDANCE ====================

// Get students by class for attendance
exports.getStudentsByClassForAttendance = async (req, res) => {
  try {
    const { grade, className } = req.query;
    
    console.log("=== getStudentsByClassForAttendance ===");
    console.log("Grade:", grade);
    console.log("Class:", className);
    console.log("School ID:", req.user.schoolId);
    
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
      grade: grade,
      className: className,
      school: schoolId,
      status: "ACTIVE",
      isDeleted: false
    }).select("name studentId grade className gender parentPhone status");
    
    console.log(`Found ${students.length} students in ${grade} ${className}`);
    
    res.json({
      success: true,
      students: students || [],
      count: (students || []).length
    });
  } catch (error) {
    console.error("Get students by class for attendance error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
      students: [],
      count: 0
    });
  }
};

// Mark student attendance - FIXED with proper date handling
exports.markStudentAttendance = async (req, res) => {
  try {
    const { grade, className, date, period, records } = req.body;
    const schoolId = req.user.schoolId;
    
    console.log("=== markStudentAttendance ===");
    console.log("Grade:", grade);
    console.log("Class:", className);
    console.log("Date:", date);
    console.log("Period:", period);
    console.log("Records count:", records?.length);
    
    if (!grade || !className || !date || !records) {
      return res.status(400).json({
        success: false,
        message: "Grade, class name, date, and records are required"
      });
    }
    
    // Create a proper date object for the attendance date
    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);
    
    console.log("Attendance date:", attendanceDate);
    
    const results = [];
    const errors = [];
    
    for (const record of records) {
      try {
        // Find student by ID
        const student = await Student.findOne({ 
          _id: record.studentId,
          school: schoolId
        });
        
        if (!student) {
          errors.push({
            studentId: record.studentId,
            error: "Student not found"
          });
          continue;
        }
        
        // Check for existing attendance record for this student on this date
        const existingAttendance = await Attendance.findOne({
          userId: record.studentId,
          userType: "STUDENT",
          date: attendanceDate,
          period: period || "DAILY",
          school: schoolId
        });
        
        const status = record.status || "PRESENT";
        const reason = record.reason || "";
        
        let savedRecord;
        if (existingAttendance) {
          // Update existing record
          console.log(`Updating attendance for student ${student.name} (${student.studentId})`);
          existingAttendance.status = status;
          existingAttendance.reason = reason;
          existingAttendance.grade = grade;
          existingAttendance.className = className;
          existingAttendance.recordedBy = req.user.id;
          existingAttendance.recordedByName = req.user.name;
          await existingAttendance.save();
          savedRecord = existingAttendance;
        } else {
          // Create new record
          console.log(`Creating new attendance for student ${student.name} (${student.studentId})`);
          const newAttendance = new Attendance({
            userId: record.studentId,
            userName: student.name,
            userType: "STUDENT",
            userIdentifier: student.studentId,
            grade: grade,
            className: className,
            status: status,
            reason: reason,
            date: attendanceDate,
            period: period || "DAILY",
            recordedBy: req.user.id,
            recordedByName: req.user.name || req.user.email || "Unknown",
            school: schoolId
          });
          await newAttendance.save();
          savedRecord = newAttendance;
        }
        results.push(savedRecord);
      } catch (error) {
        console.error(`Error processing attendance for student ${record.studentId}:`, error);
        errors.push({
          studentId: record.studentId,
          error: error.message
        });
      }
    }
    
    console.log(`Successfully saved ${results.length} attendance records`);
    
    res.status(201).json({
      success: true,
      message: `Attendance saved for ${results.length} students`,
      results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error("Mark student attendance error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get student attendance by class - FIXED date handling
exports.getStudentAttendanceByClass = async (req, res) => {
  try {
    const { grade, className, date, period } = req.query;
    const schoolId = req.user.schoolId;
    
    console.log("=== getStudentAttendanceByClass ===");
    console.log("Params:", { grade, className, date, period });
    
    if (!grade || !className || !date) {
      return res.status(400).json({
        success: false,
        message: "Grade, class name, and date are required"
      });
    }
    
    // Create proper date range
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);
    
    console.log("Date range:", { startDate, endDate });
    
    const attendance = await Attendance.find({
      grade: grade,
      className: className,
      userType: "STUDENT",
      date: { $gte: startDate, $lte: endDate },
      period: period || "DAILY",
      school: schoolId
    }).populate("recordedBy", "name");
    
    console.log(`Found ${attendance.length} attendance records`);
    
    res.json({
      success: true,
      attendance: attendance || []
    });
  } catch (error) {
    console.error("Get student attendance by class error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
      attendance: []
    });
  }
};

// Get student attendance report - FIXED for dashboard
exports.getStudentAttendanceReport = async (req, res) => {
  try {
    const { grade, className, startDate, endDate, period } = req.query;
    const schoolId = req.user.schoolId;
    
    console.log("=== getStudentAttendanceReport ===");
    console.log("Params:", { grade, className, startDate, endDate, period });
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required"
      });
    }
    
    // Create proper date range
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    let filter = {
      userType: "STUDENT",
      date: { $gte: start, $lte: end },
      school: schoolId
    };
    
    if (grade) filter.grade = grade;
    if (className) filter.className = className;
    if (period) filter.period = period;
    
    const attendance = await Attendance.find(filter)
      .populate("recordedBy", "name")
      .sort({ date: 1 });
    
    console.log(`Found ${attendance.length} attendance records for report`);
    
    // Calculate summary
    const totalDays = new Set(attendance.map(a => a.date.toISOString().split('T')[0])).size;
    const totalPresent = attendance.filter(a => a.status === "PRESENT").length;
    const totalAbsent = attendance.filter(a => a.status === "ABSENT").length;
    const totalLate = attendance.filter(a => a.status === "LATE").length;
    const totalRecords = attendance.length;
    
    const overallAttendance = totalRecords > 0 ? ((totalPresent / totalRecords) * 100).toFixed(1) : 0;
    
    // Daily breakdown
    const dailyBreakdown = {};
    attendance.forEach(a => {
      const dateKey = a.date.toISOString().split('T')[0];
      if (!dailyBreakdown[dateKey]) {
        dailyBreakdown[dateKey] = { present: 0, absent: 0, late: 0 };
      }
      if (a.status === "PRESENT") dailyBreakdown[dateKey].present++;
      else if (a.status === "ABSENT") dailyBreakdown[dateKey].absent++;
      else if (a.status === "LATE") dailyBreakdown[dateKey].late++;
    });
    
    res.json({
      success: true,
      summary: {
        schoolName: req.user.schoolName || "School",
        reportPeriod: { startDate, endDate },
        totalDays,
        totalRecords,
        totalPresent,
        totalAbsent,
        totalLate,
        averageAttendance: parseFloat(overallAttendance),
        overallAttendance: parseFloat(overallAttendance)
      },
      dailyBreakdown,
      records: attendance
    });
  } catch (error) {
    console.error("Get student attendance report error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== TEACHER ATTENDANCE ====================

// Get teachers for attendance
exports.getTeachersForAttendance = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: "School ID not found for this user"
      });
    }
    
    const teachers = await Teacher.find({
      school: schoolId,
      status: "ACTIVE"
    }).select("name email teacherId");
    
    res.json({
      success: true,
      teachers: teachers || [],
      count: (teachers || []).length
    });
  } catch (error) {
    console.error("Get teachers for attendance error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
      teachers: []
    });
  }
};

// Mark teacher attendance - FIXED with proper date handling
exports.markTeacherAttendance = async (req, res) => {
  try {
    const { date, period, records } = req.body;
    const schoolId = req.user.schoolId;
    
    console.log("=== markTeacherAttendance ===");
    console.log("Date:", date);
    console.log("Period:", period);
    console.log("Records count:", records?.length);
    
    if (!date || !records) {
      return res.status(400).json({
        success: false,
        message: "Date and records are required"
      });
    }
    
    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);
    
    const results = [];
    const errors = [];
    
    for (const record of records) {
      try {
        const teacher = await Teacher.findOne({
          _id: record.teacherId,
          school: schoolId
        });
        
        if (!teacher) {
          errors.push({
            teacherId: record.teacherId,
            error: "Teacher not found"
          });
          continue;
        }
        
        const existingAttendance = await Attendance.findOne({
          userId: record.teacherId,
          userType: "TEACHER",
          date: attendanceDate,
          period: period || "DAILY",
          school: schoolId
        });
        
        const status = record.status || "PRESENT";
        const reason = record.reason || "";
        const checkInTime = record.checkInTime || "";
        const checkOutTime = record.checkOutTime || "";
        
        let savedRecord;
        if (existingAttendance) {
          console.log(`Updating teacher attendance for ${teacher.name}`);
          existingAttendance.status = status;
          existingAttendance.reason = reason;
          existingAttendance.checkInTime = checkInTime;
          existingAttendance.checkOutTime = checkOutTime;
          existingAttendance.recordedBy = req.user.id;
          existingAttendance.recordedByName = req.user.name;
          await existingAttendance.save();
          savedRecord = existingAttendance;
        } else {
          console.log(`Creating new teacher attendance for ${teacher.name}`);
          const newAttendance = new Attendance({
            userId: record.teacherId,
            userName: teacher.name,
            userType: "TEACHER",
            userIdentifier: teacher.teacherId,
            status: status,
            reason: reason,
            checkInTime: checkInTime,
            checkOutTime: checkOutTime,
            date: attendanceDate,
            period: period || "DAILY",
            recordedBy: req.user.id,
            recordedByName: req.user.name || req.user.email || "Unknown",
            school: schoolId
          });
          await newAttendance.save();
          savedRecord = newAttendance;
        }
        results.push(savedRecord);
      } catch (error) {
        console.error(`Error processing teacher attendance:`, error);
        errors.push({
          teacherId: record.teacherId,
          error: error.message
        });
      }
    }
    
    console.log(`Successfully saved ${results.length} teacher attendance records`);
    
    res.status(201).json({
      success: true,
      message: `Attendance saved for ${results.length} teachers`,
      results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error("Mark teacher attendance error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get teacher attendance by date - FIXED date handling
exports.getTeacherAttendanceByDate = async (req, res) => {
  try {
    const { date, period } = req.query;
    const schoolId = req.user.schoolId;
    
    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date is required"
      });
    }
    
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);
    
    const attendance = await Attendance.find({
      userType: "TEACHER",
      date: { $gte: startDate, $lte: endDate },
      period: period || "DAILY",
      school: schoolId
    }).populate("recordedBy", "name");
    
    res.json({
      success: true,
      attendance: attendance || []
    });
  } catch (error) {
    console.error("Get teacher attendance by date error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
      attendance: []
    });
  }
};

// Get teacher attendance report
exports.getTeacherAttendanceReport = async (req, res) => {
  try {
    const { startDate, endDate, period } = req.query;
    const schoolId = req.user.schoolId;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required"
      });
    }
    
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    let filter = {
      userType: "TEACHER",
      date: { $gte: start, $lte: end },
      school: schoolId
    };
    
    if (period) filter.period = period;
    
    const attendance = await Attendance.find(filter)
      .populate("recordedBy", "name")
      .sort({ date: 1 });
    
    const totalDays = new Set(attendance.map(a => a.date.toISOString().split('T')[0])).size;
    const totalPresent = attendance.filter(a => a.status === "PRESENT").length;
    const totalAbsent = attendance.filter(a => a.status === "ABSENT").length;
    const totalLate = attendance.filter(a => a.status === "LATE").length;
    const totalRecords = attendance.length;
    
    const overallAttendance = totalRecords > 0 ? ((totalPresent / totalRecords) * 100).toFixed(1) : 0;
    
    const dailyBreakdown = {};
    attendance.forEach(a => {
      const dateKey = a.date.toISOString().split('T')[0];
      if (!dailyBreakdown[dateKey]) {
        dailyBreakdown[dateKey] = { present: 0, absent: 0, late: 0 };
      }
      if (a.status === "PRESENT") dailyBreakdown[dateKey].present++;
      else if (a.status === "ABSENT") dailyBreakdown[dateKey].absent++;
      else if (a.status === "LATE") dailyBreakdown[dateKey].late++;
    });
    
    res.json({
      success: true,
      summary: {
        schoolName: req.user.schoolName || "School",
        reportPeriod: { startDate, endDate },
        totalDays,
        totalRecords,
        totalPresent,
        totalAbsent,
        totalLate,
        averageAttendance: parseFloat(overallAttendance),
        overallAttendance: parseFloat(overallAttendance)
      },
      dailyBreakdown,
      records: attendance
    });
  } catch (error) {
    console.error("Get teacher attendance report error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};