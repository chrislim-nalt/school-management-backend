const EnglishPerformance = require("../models/EnglishPerformance");
const Student = require("../models/Student");

// Record English violation (Teacher/School Admin)
exports.recordViolation = async (req, res) => {
  try {
    const { studentId, location, context, actionTaken, semester, date } = req.body;
    
    const student = await Student.findOne({ _id: studentId, school: req.user.schoolId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    
    const academicYear = new Date().getFullYear();
    
    // Find or create performance record
    let performance = await EnglishPerformance.findOne({
      student: studentId,
      semester,
      academicYear,
      school: req.user.schoolId
    });
    
    if (!performance) {
      performance = new EnglishPerformance({
        student: studentId,
        studentName: student.name,
        studentId: student.studentId,
        grade: student.grade,
        className: student.className,
        semester,
        academicYear,
        violations: [],
        weeklyStats: [],
        school: req.user.schoolId
      });
    }
    
    // Add violation
    const violationDate = date ? new Date(date) : new Date();
    performance.violations.push({
      date: violationDate,
      location,
      context,
      recordedBy: req.user.id,
      recordedByName: req.user.name,
      actionTaken,
      semester
    });
    
    // Update weekly stats
    const weekNumber = getWeekNumber(violationDate);
    const weekIndex = performance.weeklyStats.findIndex(
      w => w.week === weekNumber && w.year === violationDate.getFullYear()
    );
    
    if (weekIndex >= 0) {
      performance.weeklyStats[weekIndex].violationCount++;
    } else {
      performance.weeklyStats.push({
        week: weekNumber,
        year: violationDate.getFullYear(),
        violationCount: 1,
        improvement: 0
      });
    }
    
    // Calculate improvement trend
    const sortedWeeks = [...performance.weeklyStats].sort((a, b) => a.week - b.week);
    for (let i = 1; i < sortedWeeks.length; i++) {
      const prevCount = sortedWeeks[i-1].violationCount;
      const currCount = sortedWeeks[i].violationCount;
      if (currCount < prevCount) sortedWeeks[i].improvement = 1;
      else if (currCount > prevCount) sortedWeeks[i].improvement = -1;
      else sortedWeeks[i].improvement = 0;
    }
    
    await performance.save();
    
    // Update student's violation count
    student.englishViolationCount = performance.violations.length;
    await student.save();
    
    res.status(201).json({
      success: true,
      message: "English violation recorded",
      violation: performance.violations[performance.violations.length - 1],
      totalViolations: performance.violations.length
    });
  } catch (error) {
    console.error("Record violation error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get class English performance dashboard (with charts data)
exports.getClassEnglishDashboard = async (req, res) => {
  try {
    const { grade, className, semester } = req.query;
    
    let filter = { school: req.user.schoolId, semester };
    if (grade) filter.grade = grade;
    if (className) filter.className = className;
    
    const performances = await EnglishPerformance.find(filter).populate("student", "name studentId");
    
    // Summary statistics
    const summary = {
      totalStudents: performances.length,
      totalViolations: performances.reduce((sum, p) => sum + p.violations.length, 0),
      averageViolationsPerStudent: performances.length > 0
        ? (performances.reduce((sum, p) => sum + p.violations.length, 0) / performances.length).toFixed(1)
        : 0,
      studentsWithViolations: performances.filter(p => p.violations.length > 0).length,
      studentsWithoutViolations: performances.filter(p => p.violations.length === 0).length
    };
    
    // Violation distribution by location
    const locationDistribution = {
      CLASSROOM: 0,
      HALL: 0,
      PLAYGROUND: 0,
      DORMITORY: 0,
      OTHER: 0
    };
    
    performances.forEach(p => {
      p.violations.forEach(v => {
        if (locationDistribution[v.location] !== undefined) {
          locationDistribution[v.location]++;
        }
      });
    });
    
    // Weekly trend data for chart
    const weeklyTrend = [];
    const last12Weeks = [];
    const today = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const weekDate = new Date(today);
      weekDate.setDate(today.getDate() - (i * 7));
      const weekLabel = `Week ${getWeekNumber(weekDate)}`;
      weeklyTrend.push({ week: weekLabel, count: 0 });
      last12Weeks.push(weekLabel);
    }
    
    performances.forEach(p => {
      p.violations.forEach(v => {
        const violationWeek = getWeekNumber(new Date(v.date));
        const weekIndex = weeklyTrend.findIndex(w => w.week === `Week ${violationWeek}`);
        if (weekIndex >= 0) {
          weeklyTrend[weekIndex].count++;
        }
      });
    });
    
    // Top violators (red dots / warning indicators)
    const topViolators = performances
      .filter(p => p.violations.length > 0)
      .sort((a, b) => b.violations.length - a.violations.length)
      .slice(0, 10)
      .map(p => ({
        studentName: p.studentName,
        studentId: p.studentId,
        grade: p.grade,
        className: p.className,
        violationCount: p.violations.length,
        severity: p.violations.length >= 5 ? "HIGH" : p.violations.length >= 3 ? "MEDIUM" : "LOW",
        recentViolations: p.violations.slice(-3).map(v => ({
          date: v.date,
          location: v.location
        }))
      }));
    
    res.json({
      summary,
      locationDistribution,
      weeklyTrend,
      topViolators,
      performances: performances.map(p => ({
        studentName: p.studentName,
        studentId: p.studentId,
        violationCount: p.violations.length,
        status: p.violations.length === 0 ? "GREEN" : p.violations.length <= 2 ? "YELLOW" : "RED"
      }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get student English performance details
exports.getStudentEnglishPerformance = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { semester } = req.query;
    
    const performance = await EnglishPerformance.findOne({
      student: studentId,
      semester,
      school: req.user.schoolId
    });
    
    if (!performance) {
      return res.json({
        message: "No English performance records found",
        studentId,
        violations: [],
        weeklyStats: [],
        totalViolations: 0
      });
    }
    
    res.json(performance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get English performance report (professional)
exports.getEnglishPerformanceReport = async (req, res) => {
  try {
    const { semester, academicYear, grade, className } = req.query;
    
    let filter = { school: req.user.schoolId, semester, academicYear: parseInt(academicYear) };
    if (grade) filter.grade = grade;
    if (className) filter.className = className;
    
    const performances = await EnglishPerformance.find(filter).populate("student", "name studentId");
    
    // Performance categories based on violation count
    const categories = {
      excellent: { count: 0, students: [], maxViolations: 0 },
      good: { count: 0, students: [], maxViolations: 2 },
      needsImprovement: { count: 0, students: [], maxViolations: 4 },
      critical: { count: 0, students: [], maxViolations: Infinity }
    };
    
    performances.forEach(p => {
      const violationCount = p.violations.length;
      if (violationCount === 0) categories.excellent.count++, categories.excellent.students.push(p);
      else if (violationCount <= 2) categories.good.count++, categories.good.students.push(p);
      else if (violationCount <= 4) categories.needsImprovement.count++, categories.needsImprovement.students.push(p);
      else categories.critical.count++, categories.critical.students.push(p);
    });
    
    // Calculate improvement trend
    let improvementTrend = "STABLE";
    if (performances.length > 0) {
      const recentWeeks = performances.flatMap(p => p.weeklyStats.slice(-3));
      const avgRecent = recentWeeks.reduce((sum, w) => sum + w.violationCount, 0) / (recentWeeks.length || 1);
      const olderWeeks = performances.flatMap(p => p.weeklyStats.slice(0, -3));
      const avgOlder = olderWeeks.reduce((sum, w) => sum + w.violationCount, 0) / (olderWeeks.length || 1);
      
      if (avgRecent < avgOlder) improvementTrend = "IMPROVING";
      else if (avgRecent > avgOlder) improvementTrend = "DECLINING";
    }
    
    res.json({
      reportPeriod: { semester, academicYear, grade, className },
      categories,
      improvementTrend,
      totalViolations: performances.reduce((sum, p) => sum + p.violations.length, 0),
      averageViolationsPerStudent: (performances.reduce((sum, p) => sum + p.violations.length, 0) / (performances.length || 1)).toFixed(1),
      studentsNeedingIntervention: categories.critical.count,
      detailedRecords: performances.map(p => ({
        studentName: p.studentName,
        studentId: p.studentId,
        totalViolations: p.violations.length,
        weeklyViolations: p.weeklyStats,
        recentViolations: p.violations.slice(-5)
      }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Helper function: get week number
function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}