const Mark = require("../models/Mark");

// Get all marks
exports.getMarks = async (req, res) => {
  try {
    const { term, year, grade, course } = req.query;
    let filter = { school: req.user.schoolId };
    
    if (term) filter.term = term;
    if (year) filter.year = parseInt(year);
    if (course) filter.course = course;
    
    let marks = await Mark.find(filter)
      .populate("student", "name studentId grade className")
      .populate("course", "courseName courseCode")
      .populate("recordedBy", "name");
    
    if (grade) {
      marks = marks.filter(m => m.student?.grade === grade);
    }
    
    res.json(marks);
  } catch (error) {
    console.error("Get marks error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Create or update marks (bulk)
exports.bulkUpsertMarks = async (req, res) => {
  try {
    const { marks, term, year } = req.body;
    const results = [];
    
    if (!marks || marks.length === 0) {
      return res.status(400).json({ message: "No marks data provided" });
    }
    
    for (const mark of marks) {
      const existingMark = await Mark.findOne({
        student: mark.studentId,
        course: mark.courseId,
        term,
        year,
        school: req.user.schoolId
      });
      
      const markData = {
        student: mark.studentId,
        course: mark.courseId,
        term,
        year,
        continuousAssessment: mark.continuousAssessment || 0,
        examScore: mark.examScore || 0,
        recordedBy: req.user.id,
        school: req.user.schoolId
      };
      
      let result;
      if (existingMark) {
        result = await Mark.findByIdAndUpdate(existingMark._id, markData, { new: true });
      } else {
        result = await Mark.create(markData);
      }
      results.push(result);
    }
    
    res.status(201).json({
      success: true,
      message: "Marks saved successfully",
      results
    });
  } catch (error) {
    console.error("Bulk upsert marks error:", error);
    res.status(400).json({ message: error.message });
  }
};

// Get marks analytics
exports.getMarksAnalytics = async (req, res) => {
  try {
    const { term, year } = req.query;
    
    const marks = await Mark.find({
      term,
      year: parseInt(year),
      school: req.user.schoolId
    }).populate("course", "courseName");
    
    const totalStudents = new Set(marks.map(m => m.student.toString())).size;
    const averageScore = marks.length > 0 ? marks.reduce((sum, m) => sum + m.totalScore, 0) / marks.length : 0;
    
    const gradeDistribution = {
      A: marks.filter(m => m.grade === "A").length,
      B: marks.filter(m => m.grade === "B").length,
      C: marks.filter(m => m.grade === "C").length,
      D: marks.filter(m => m.grade === "D").length,
      F: marks.filter(m => m.grade === "F").length
    };
    
    const performanceByCourse = {};
    marks.forEach(mark => {
      const courseName = mark.course?.courseName || "Unknown";
      if (!performanceByCourse[courseName]) {
        performanceByCourse[courseName] = { total: 0, count: 0 };
      }
      performanceByCourse[courseName].total += mark.totalScore;
      performanceByCourse[courseName].count += 1;
    });
    
    const coursePerformance = Object.entries(performanceByCourse).map(([name, data]) => ({
      course: name,
      average: (data.total / data.count).toFixed(1),
      studentsCount: data.count
    }));
    
    res.json({
      totalStudents,
      totalMarks: marks.length,
      averageScore: averageScore.toFixed(1),
      gradeDistribution,
      coursePerformance,
      passRate: ((gradeDistribution.A + gradeDistribution.B + gradeDistribution.C) / (marks.length || 1) * 100).toFixed(1)
    });
  } catch (error) {
    console.error("Get marks analytics error:", error);
    res.status(500).json({ message: error.message });
  }
};