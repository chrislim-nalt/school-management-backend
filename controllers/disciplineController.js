const Discipline = require("../models/Discipline");
const Student = require("../models/Student");

// Helper function to check permissions
const hasPermission = (user, allowedTypes) => {
  if (user.role === "superadmin") return true;
  return allowedTypes.includes(user.userType);
};

// Add discipline offense (Teacher/School Admin)
exports.addOffense = async (req, res) => {
  try {
    // Check permission - Teachers and Admins can add offenses
    if (!hasPermission(req.user, ["school_admin", "teacher"])) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Only teachers and administrators can record offenses." 
      });
    }

    const { studentId, offenseType, description, pointsDeducted, semester, date } = req.body;
    
    const student = await Student.findOne({ _id: studentId, school: req.user.schoolId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    
    // Find or create discipline record
    let discipline = await Discipline.findOne({
      student: studentId,
      semester,
      academicYear: new Date().getFullYear(),
      school: req.user.schoolId
    });
    
    if (!discipline) {
      discipline = new Discipline({
        student: studentId,
        studentName: student.name,
        studentId: student.studentId,
        grade: student.grade,
        className: student.className,
        semester,
        academicYear: new Date().getFullYear(),
        conductScore: 40,
        school: req.user.schoolId
      });
    }
    
    // Add offense
    discipline.offenses.push({
      offenseType,
      description,
      pointsDeducted: pointsDeducted || 0,
      date: date || new Date(),
      recordedBy: req.user.id,
      recordedByName: req.user.name,
      semester
    });
    
    // Update conduct score
    discipline.updateConductScore();
    await discipline.save();
    
    // Update student's current conduct score
    student.currentConductScore = discipline.conductScore;
    await student.save();
    
    res.status(201).json({
      success: true,
      message: "Offense recorded successfully",
      discipline: {
        conductScore: discipline.conductScore,
        offenses: discipline.offenses
      }
    });
  } catch (error) {
    console.error("Add offense error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get student discipline (Teacher/School Admin)
exports.getStudentDiscipline = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { semester } = req.query;
    
    // Teachers can only view students in their class (you can add class filtering)
    if (!hasPermission(req.user, ["school_admin", "teacher"])) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied." 
      });
    }
    
    let filter = { student: studentId, school: req.user.schoolId };
    if (semester) filter.semester = semester;
    
    const discipline = await Discipline.find(filter).sort({ createdAt: -1 });
    
    res.json(discipline);
  } catch (error) {
    console.error("Get student discipline error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get class discipline summary (School Admin only)
exports.getClassDisciplineSummary = async (req, res) => {
  try {
    // Strict permission check - Only School Admin and Super Admin
    if (!hasPermission(req.user, ["school_admin"])) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Only administrators can view class discipline summary." 
      });
    }

    const { grade, className, semester } = req.query;
    
    let filter = { school: req.user.schoolId, semester };
    if (grade) filter.grade = grade;
    if (className) filter.className = className;
    
    const disciplines = await Discipline.find(filter).populate("student", "name studentId");
    
    // Calculate summary statistics
    const summary = {
      totalStudents: disciplines.length,
      averageConductScore: disciplines.length > 0
        ? (disciplines.reduce((sum, d) => sum + d.conductScore, 0) / disciplines.length).toFixed(1)
        : 0,
      totalOffenses: disciplines.reduce((sum, d) => sum + d.offenses.length, 0),
      studentsWithLowConduct: disciplines.filter(d => d.conductScore < 30).length,
      studentsWithGoodConduct: disciplines.filter(d => d.conductScore >= 35).length
    };
    
    // Offense distribution
    const offenseDistribution = {
      MISCONDUCT: 0,
      LATE_COMING: 0,
      FIGHTING: 0,
      DISRESPECT: 0,
      OTHER: 0
    };
    
    disciplines.forEach(d => {
      d.offenses.forEach(o => {
        if (offenseDistribution[o.offenseType] !== undefined) {
          offenseDistribution[o.offenseType]++;
        }
      });
    });
    
    // Weekly trend (last 12 weeks)
    const weeklyTrend = {};
    const today = new Date();
    for (let i = 0; i < 12; i++) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - (i * 7));
      const weekKey = `${weekStart.getFullYear()}-W${Math.ceil(weekStart.getDate() / 7)}`;
      weeklyTrend[weekKey] = 0;
    }
    
    disciplines.forEach(d => {
      d.offenses.forEach(o => {
        const offenseDate = new Date(o.date);
        const weekKey = `${offenseDate.getFullYear()}-W${Math.ceil(offenseDate.getDate() / 7)}`;
        if (weeklyTrend[weekKey] !== undefined) {
          weeklyTrend[weekKey]++;
        }
      });
    });
    
    res.json({
      summary,
      offenseDistribution,
      weeklyTrend,
      topOffenders: disciplines
        .sort((a, b) => b.offenses.length - a.offenses.length)
        .slice(0, 10)
        .map(d => ({
          studentName: d.studentName,
          studentId: d.studentId,
          conductScore: d.conductScore,
          offenseCount: d.offenses.length
        })),
      disciplines
    });
  } catch (error) {
    console.error("Get class discipline summary error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get conduct report (School Admin only)
exports.getConductReport = async (req, res) => {
  try {
    // Strict permission check - Only School Admin and Super Admin
    if (!hasPermission(req.user, ["school_admin"])) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Only administrators can view conduct reports." 
      });
    }

    const { semester, academicYear, grade, className } = req.query;
    
    let filter = { school: req.user.schoolId, semester, academicYear: parseInt(academicYear) };
    if (grade) filter.grade = grade;
    if (className) filter.className = className;
    
    const disciplines = await Discipline.find(filter).populate("student", "name studentId");
    
    // Performance categories
    const categories = {
      excellent: { count: 0, students: [], minScore: 36, maxScore: 40 },
      good: { count: 0, students: [], minScore: 30, maxScore: 35 },
      average: { count: 0, students: [], minScore: 20, maxScore: 29 },
      poor: { count: 0, students: [], minScore: 0, maxScore: 19 }
    };
    
    disciplines.forEach(d => {
      if (d.conductScore >= 36) categories.excellent.count++, categories.excellent.students.push(d);
      else if (d.conductScore >= 30) categories.good.count++, categories.good.students.push(d);
      else if (d.conductScore >= 20) categories.average.count++, categories.average.students.push(d);
      else categories.poor.count++, categories.poor.students.push(d);
    });
    
    res.json({
      reportPeriod: { semester, academicYear },
      categories,
      overallAverage: disciplines.length > 0
        ? (disciplines.reduce((sum, d) => sum + d.conductScore, 0) / disciplines.length).toFixed(1)
        : 0,
      totalStudents: disciplines.length,
      studentsWithPerfectConduct: disciplines.filter(d => d.conductScore === 40).length,
      studentsNeedingIntervention: disciplines.filter(d => d.conductScore < 25).length,
      detailedRecords: disciplines
    });
  } catch (error) {
    console.error("Get conduct report error:", error);
    res.status(500).json({ message: error.message });
  }
};