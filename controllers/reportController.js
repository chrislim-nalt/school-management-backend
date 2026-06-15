const Mark = require("../models/Mark");
const Attendance = require("../models/Attendance");
const TransportPayment = require("../models/TransportPayment");
const TransportRecord = require("../models/TransportRecord");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");

// Get daily report
exports.getDailyReport = async (req, res) => {
  try {
    const { date } = req.query;
    const reportDate = new Date(date);
    const nextDay = new Date(reportDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    const studentAttendance = await Attendance.find({
      userType: "STUDENT",
      date: { $gte: reportDate, $lt: nextDay },
      school: req.user.schoolId
    });
    
    const teacherAttendance = await Attendance.find({
      userType: "TEACHER",
      date: { $gte: reportDate, $lt: nextDay },
      school: req.user.schoolId
    });
    
    const transportRecords = await TransportRecord.find({
      date: { $gte: reportDate, $lt: nextDay },
      school: req.user.schoolId
    }).populate("student", "name studentId");
    
    res.json({
      date: reportDate.toISOString().split('T')[0],
      studentAttendance: {
        present: studentAttendance.filter(a => a.status === "PRESENT").length,
        absent: studentAttendance.filter(a => a.status === "ABSENT").length,
        late: studentAttendance.filter(a => a.status === "LATE").length,
        total: studentAttendance.length
      },
      teacherAttendance: {
        present: teacherAttendance.filter(a => a.status === "PRESENT").length,
        absent: teacherAttendance.filter(a => a.status === "ABSENT").length,
        late: teacherAttendance.filter(a => a.status === "LATE").length,
        total: teacherAttendance.length
      },
      transport: {
        totalTrips: transportRecords.length,
        completed: transportRecords.filter(r => r.status === "COMPLETED").length,
        absent: transportRecords.filter(r => r.status === "ABSENT").length
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get weekly report
exports.getWeeklyReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1);
    
    const studentAttendance = await Attendance.find({
      userType: "STUDENT",
      date: { $gte: start, $lt: end },
      school: req.user.schoolId
    });
    
    const transportPayments = await TransportPayment.find({
      createdAt: { $gte: start, $lt: end },
      school: req.user.schoolId
    });
    
    const transportRecords = await TransportRecord.find({
      date: { $gte: start, $lt: end },
      school: req.user.schoolId
    });
    
    res.json({
      period: { start: startDate, end: endDate },
      summary: {
        totalStudentAttendance: studentAttendance.length,
        totalTransportPayments: transportPayments.reduce((sum, p) => sum + p.amountPaid, 0),
        totalTransportTrips: transportRecords.length
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get monthly report
exports.getMonthlyReport = async (req, res) => {
  try {
    const { month, year } = req.query;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    endDate.setDate(endDate.getDate() + 1);
    
    const marks = await Mark.find({
      createdAt: { $gte: startDate, $lt: endDate },
      school: req.user.schoolId
    });
    
    const attendance = await Attendance.find({
      createdAt: { $gte: startDate, $lt: endDate },
      school: req.user.schoolId
    });
    
    const transportPayments = await TransportPayment.find({
      createdAt: { $gte: startDate, $lt: endDate },
      school: req.user.schoolId
    });
    
    const averageScore = marks.length > 0 
      ? marks.reduce((sum, m) => sum + m.totalScore, 0) / marks.length 
      : 0;
    
    res.json({
      period: { month, year },
      performance: {
        averageScore: averageScore.toFixed(1),
        totalExams: marks.length
      },
      attendance: {
        studentAttendance: attendance.filter(a => a.userType === "STUDENT").length,
        teacherAttendance: attendance.filter(a => a.userType === "TEACHER").length
      },
      finance: {
        transportRevenue: transportPayments.reduce((sum, p) => sum + p.amountPaid, 0),
        totalPayments: transportPayments.length
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get yearly report
exports.getYearlyReport = async (req, res) => {
  try {
    const { year } = req.query;
    
    const marks = await Mark.find({
      year: parseInt(year),
      school: req.user.schoolId
    });
    
    const attendance = await Attendance.find({
      school: req.user.schoolId
    });
    
    const transportPayments = await TransportPayment.find({
      year: parseInt(year),
      school: req.user.schoolId
    });
    
    const students = await Student.find({ school: req.user.schoolId });
    const teachers = await Teacher.find({ school: req.user.schoolId });
    
    const totalRevenue = transportPayments.reduce((sum, p) => sum + p.amountPaid, 0);
    const averageScore = marks.length > 0 
      ? marks.reduce((sum, m) => sum + m.totalScore, 0) / marks.length 
      : 0;
    
    res.json({
      year,
      summary: {
        totalStudents: students.length,
        totalTeachers: teachers.length,
        totalExamsConducted: marks.length,
        totalAttendanceRecords: attendance.length,
        averageScore: averageScore.toFixed(1),
        totalTransportRevenue: totalRevenue
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};