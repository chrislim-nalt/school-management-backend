const Activity = require("../models/Activity");
const Student = require("../models/Student");
const Course = require("../models/Course");

exports.createActivity = async (req, res) => {
  try {
    const { studentId, courseId, activityType, title, description, score, maxScore, date, term } = req.body;
    
    const student = await Student.findOne({ _id: studentId, school: req.user.schoolId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    
    const course = await Course.findOne({ _id: courseId, school: req.user.schoolId });
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    
    const activity = new Activity({
      student: studentId,
      studentName: student.name,
      studentId: student.studentId,
      grade: student.grade,
      className: student.className,
      course: courseId,
      courseName: course.courseName,
      activityType,
      title,
      description,
      score,
      maxScore: maxScore || 100,
      date: date || new Date(),
      term,
      academicYear: new Date().getFullYear(),
      semester: term,
      recordedBy: req.user.id,
      recordedByName: req.user.name,
      school: req.user.schoolId
    });
    
    await activity.save();
    
    res.status(201).json({
      success: true,
      message: "Activity recorded",
      activity
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getActivities = async (req, res) => {
  try {
    const { studentId, courseId, activityType, term } = req.query;
    let filter = { school: req.user.schoolId };
    
    if (studentId) filter.student = studentId;
    if (courseId) filter.course = courseId;
    if (activityType) filter.activityType = activityType;
    if (term) filter.term = term;
    
    const activities = await Activity.find(filter)
      .populate("student", "name studentId")
      .populate("course", "courseName courseCode")
      .sort({ date: -1 });
    
    res.json(activities);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getStudentPerformanceByCourse = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { term } = req.query;
    
    const activities = await Activity.find({
      student: studentId,
      term,
      school: req.user.schoolId
    }).populate("course", "courseName");
    
    // Group by course
    const byCourse = {};
    activities.forEach(a => {
      if (!byCourse[a.courseName]) {
        byCourse[a.courseName] = {
          exercises: [],
          quizzes: [],
          homeworks: [],
          exams: [],
          overallAverage: 0,
          totalScores: 0,
          count: 0
        };
      }
      
      byCourse[a.courseName][a.activityType.toLowerCase() + 's'].push(a.percentage);
      byCourse[a.courseName].totalScores += a.percentage;
      byCourse[a.courseName].count++;
      byCourse[a.courseName].overallAverage = byCourse[a.courseName].totalScores / byCourse[a.courseName].count;
    });
    
    res.json(byCourse);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getClassPerformanceDashboard = async (req, res) => {
  try {
    const { grade, className, term } = req.query;
    
    let filter = { school: req.user.schoolId, term };
    if (grade) filter.grade = grade;
    if (className) filter.className = className;
    
    const activities = await Activity.find(filter).populate("course", "courseName");
    
    // Get all students in class
    const students = await Student.find({ grade, className, school: req.user.schoolId });
    
    // Calculate class averages by activity type
    const activityAverages = {
      EXERCISE: 0,
      QUIZ: 0,
      HOMEWORK: 0,
      EXAM: 0
    };
    
    const activityCounts = {
      EXERCISE: 0,
      QUIZ: 0,
      HOMEWORK: 0,
      EXAM: 0
    };
    
    activities.forEach(a => {
      activityAverages[a.activityType] += a.percentage;
      activityCounts[a.activityType]++;
    });
    
    Object.keys(activityAverages).forEach(key => {
      activityAverages[key] = activityCounts[key] > 0 ? (activityAverages[key] / activityCounts[key]).toFixed(1) : 0;
    });
    
    // Performance by course
    const coursePerformance = {};
    activities.forEach(a => {
      if (!coursePerformance[a.courseName]) {
        coursePerformance[a.courseName] = { total: 0, count: 0, average: 0 };
      }
      coursePerformance[a.courseName].total += a.percentage;
      coursePerformance[a.courseName].count++;
      coursePerformance[a.courseName].average = (coursePerformance[a.courseName].total / coursePerformance[a.courseName].count).toFixed(1);
    });
    
    // Student ranking
    const studentAverages = {};
    activities.forEach(a => {
      if (!studentAverages[a.studentName]) {
        studentAverages[a.studentName] = { total: 0, count: 0, studentId: a.studentId };
      }
      studentAverages[a.studentName].total += a.percentage;
      studentAverages[a.studentName].count++;
    });
    
    const studentRanking = Object.entries(studentAverages).map(([name, data]) => ({
      studentName: name,
      studentId: data.studentId,
      average: (data.total / data.count).toFixed(1)
    })).sort((a, b) => b.average - a.average);
    
    res.json({
      classInfo: { grade, className, totalStudents: students.length },
      activityAverages,
      coursePerformance,
      studentRanking: studentRanking.slice(0, 10), // Top 10
      bottomPerformers: studentRanking.slice(-5) // Bottom 5
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getCoursePerformanceAnalysis = async (req, res) => {
  try {
    const { courseId, term } = req.query;
    
    const activities = await Activity.find({
      course: courseId,
      term,
      school: req.user.schoolId
    });
    
    const course = await Course.findById(courseId);
    
    // Group by class
    const byClass = {};
    activities.forEach(a => {
      const key = `${a.grade} - ${a.className}`;
      if (!byClass[key]) {
        byClass[key] = { total: 0, count: 0, students: new Set() };
      }
      byClass[key].total += a.percentage;
      byClass[key].count++;
      byClass[key].students.add(a.studentId);
    });
    
    const classPerformance = Object.entries(byClass).map(([className, data]) => ({
      className,
      averageScore: (data.total / data.count).toFixed(1),
      studentCount: data.students.size,
      totalActivities: data.count
    }));
    
    // Weakness areas by activity type
    const weaknessByType = {
      EXERCISE: { total: 0, count: 0 },
      QUIZ: { total: 0, count: 0 },
      HOMEWORK: { total: 0, count: 0 },
      EXAM: { total: 0, count: 0 }
    };
    
    activities.forEach(a => {
      weaknessByType[a.activityType].total += a.percentage;
      weaknessByType[a.activityType].count++;
    });
    
    const weaknessAnalysis = Object.entries(weaknessByType).map(([type, data]) => ({
      activityType: type,
      averageScore: data.count > 0 ? (data.total / data.count).toFixed(1) : 0,
      needsImprovement: data.count > 0 && (data.total / data.count) < 60
    }));
    
    res.json({
      courseName: course?.courseName,
      classPerformance,
      weaknessAnalysis,
      recommendations: weaknessAnalysis
        .filter(w => w.needsImprovement)
        .map(w => `Students need more support in ${w.activityType.toLowerCase()} activities`)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPerformanceReport = async (req, res) => {
  try {
    const { term, academicYear, grade, className } = req.query;
    
    let filter = { school: req.user.schoolId, term, academicYear: parseInt(academicYear) };
    if (grade) filter.grade = grade;
    if (className) filter.className = className;
    
    const activities = await Activity.find(filter).populate("course", "courseName");
    
    const summary = {
      totalActivities: activities.length,
      totalStudents: new Set(activities.map(a => a.studentId)).size,
      overallAverage: activities.length > 0
        ? (activities.reduce((sum, a) => sum + a.percentage, 0) / activities.length).toFixed(1)
        : 0,
      performanceLevels: {
        excellent: activities.filter(a => a.percentage >= 80).length,
        good: activities.filter(a => a.percentage >= 70 && a.percentage < 80).length,
        average: activities.filter(a => a.percentage >= 50 && a.percentage < 70).length,
        poor: activities.filter(a => a.percentage < 50).length
      }
    };
    
    res.json({ summary, activities });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};