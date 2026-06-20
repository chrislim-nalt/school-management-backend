const Activity = require("../models/Activity");
const Student = require("../models/Student");
const Course = require("../models/Course");
const { v4: uuidv4 } = require("uuid");

// Helper function to calculate percentage
const calculatePercentage = (score, maxScore) => {
  if (!maxScore || maxScore <= 0) return 0;
  return parseFloat(((score / maxScore) * 100).toFixed(1));
};

// ==================== ASSIGN ACTIVITY TO CLASS ====================

exports.assignActivityToClass = async (req, res) => {
  try {
    console.log("=== ASSIGN ACTIVITY TO CLASS ===");
    console.log("Request body:", req.body);
    console.log("User:", req.user);
    
    const { 
      grade, 
      className, 
      courseId, 
      activityType, 
      title, 
      description, 
      maxScore, 
      date, 
      term,
      scores 
    } = req.body;
    
    // Validate required fields
    if (!grade || !className || !courseId || !activityType || !title || !term) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing required fields: grade, className, courseId, activityType, title, term" 
      });
    }
    
    // Validate course
    const course = await Course.findOne({ _id: courseId, school: req.user.schoolId });
    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }
    
    // Get all students in the class
    const students = await Student.find({
      grade,
      className,
      school: req.user.schoolId,
      status: "ACTIVE",
      isDeleted: false
    });
    
    if (students.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "No students found in this class" 
      });
    }
    
    const parsedMaxScore = parseFloat(maxScore) || 100;
    const batchId = uuidv4();
    const academicYear = new Date().getFullYear();
    const activityDate = date || new Date();
    
    // Create activity records for each student
    const activities = [];
    const errors = [];
    const studentActivityMap = {}; // Map studentId to activity _id
    
    for (const student of students) {
      try {
        let score = 0;
        if (scores && scores[student._id.toString()]) {
          score = parseFloat(scores[student._id.toString()]) || 0;
        }
        
        if (score < 0 || score > parsedMaxScore) {
          errors.push({
            student: student.name,
            studentId: student.studentId,
            error: `Score ${score} exceeds max score ${parsedMaxScore}`
          });
          continue;
        }
        
        const percentage = calculatePercentage(score, parsedMaxScore);
        
        const activityData = {
          grade,
          className,
          course: courseId,
          courseName: course.courseName,
          activityType,
          title: title.trim(),
          description: description || "",
          maxScore: parsedMaxScore,
          student: student._id,
          studentName: student.name,
          studentId: student.studentId,
          score: score,
          percentage: percentage,
          date: activityDate,
          term,
          academicYear: academicYear,
          semester: term,
          recordedBy: req.user.id,
          recordedByName: req.user.name || req.user.email || "Unknown",
          school: req.user.schoolId,
          batchId: batchId
        };
        
        const activity = new Activity(activityData);
        await activity.save();
        activities.push(activity);
        studentActivityMap[student._id.toString()] = activity._id.toString();
      } catch (error) {
        console.error(`Error creating activity for student ${student.name}:`, error);
        errors.push({
          student: student.name,
          studentId: student.studentId,
          error: error.message
        });
      }
    }
    
    console.log(`Created ${activities.length} activities for class ${grade} ${className}`);
    
    const populatedActivities = await Activity.find({ batchId })
      .populate("student", "name studentId")
      .populate("course", "courseName courseCode");
    
    res.status(201).json({
      success: true,
      message: `Activity assigned to ${activities.length} students in ${grade} ${className}`,
      batchId,
      totalStudents: students.length,
      successful: activities.length,
      errors: errors.length > 0 ? errors : undefined,
      activities: populatedActivities,
      studentActivityMap: studentActivityMap // Return mapping for frontend
    });
  } catch (error) {
    console.error("Assign activity to class error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message || "Failed to assign activity" 
    });
  }
};

// ==================== GET CLASS ACTIVITIES ====================

exports.getClassActivities = async (req, res) => {
  try {
    const { grade, className, term, courseId, activityType, startDate, endDate } = req.query;
    
    if (!grade || !className) {
      return res.status(400).json({
        success: false,
        message: "Grade and class name are required"
      });
    }
    
    let filter = { 
      school: req.user.schoolId,
      grade,
      className
    };
    
    if (term) filter.term = term;
    if (courseId) filter.course = courseId;
    if (activityType) filter.activityType = activityType;
    if (startDate && endDate) {
      filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    
    const activities = await Activity.find(filter)
      .populate("student", "name studentId")
      .populate("course", "courseName courseCode")
      .sort({ date: -1 });
    
    // Group by batch
    const groupedByBatch = {};
    activities.forEach(a => {
      if (a.batchId) {
        if (!groupedByBatch[a.batchId]) {
          groupedByBatch[a.batchId] = {
            batchId: a.batchId,
            title: a.title,
            activityType: a.activityType,
            courseName: a.courseName,
            maxScore: a.maxScore,
            date: a.date,
            term: a.term,
            students: [],
            activityIds: {} // Map studentId to activity _id
          };
        }
        groupedByBatch[a.batchId].students.push({
          studentId: a.studentId,
          studentName: a.studentName,
          score: a.score,
          percentage: a.percentage,
          activityId: a._id // Add the actual activity _id
        });
        groupedByBatch[a.batchId].activityIds[a.studentId] = a._id;
      }
    });
    
    // Calculate batch statistics
    const batchStats = Object.values(groupedByBatch).map(batch => {
      const scores = batch.students.map(s => s.percentage);
      const total = scores.length;
      const submitted = scores.filter(s => s > 0).length;
      const average = total > 0 ? parseFloat((scores.reduce((a, b) => a + b, 0) / total).toFixed(1)) : 0;
      const passCount = scores.filter(s => s >= 50).length;
      
      return {
        ...batch,
        statistics: {
          totalStudents: total,
          submitted,
          completionRate: total > 0 ? parseFloat(((submitted / total) * 100).toFixed(1)) : 0,
          averageScore: average,
          passRate: total > 0 ? parseFloat(((passCount / total) * 100).toFixed(1)) : 0,
          highestScore: total > 0 ? Math.max(...scores) : 0,
          lowestScore: total > 0 ? Math.min(...scores) : 0
        }
      };
    });
    
    res.json({
      success: true,
      activities,
      groupedByBatch: batchStats,
      count: activities.length,
      batches: batchStats.length
    });
  } catch (error) {
    console.error("Get class activities error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ==================== UPDATE STUDENT SCORE - FIXED ====================

exports.updateStudentScore = async (req, res) => {
  try {
    const { activityId, studentId, score } = req.body;
    
    console.log("=== UPDATE STUDENT SCORE ===");
    console.log("Activity ID received:", activityId);
    console.log("Student ID received:", studentId);
    console.log("Score:", score);
    
    if (!activityId || !studentId || score === undefined) {
      return res.status(400).json({
        success: false,
        message: "Activity ID, Student ID, and score are required"
      });
    }
    
    // Find the student by their MongoDB _id or display ID
    let student;
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(studentId);
    
    if (isObjectId) {
      student = await Student.findOne({ _id: studentId, school: req.user.schoolId });
    } else {
      student = await Student.findOne({ studentId: studentId, school: req.user.schoolId });
    }
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: `Student not found with ID: ${studentId}`
      });
    }
    
    console.log("Found student:", student.name, "with _id:", student._id);
    
    // Find the activity - the activityId could be either:
    // 1. A MongoDB ObjectId (24 hex chars) - the actual activity _id
    // 2. A UUID (batchId) - then we need to find the specific activity for this student
    let activity;
    const isActivityObjectId = /^[0-9a-fA-F]{24}$/.test(activityId);
    
    if (isActivityObjectId) {
      // It's a MongoDB ObjectId, find directly
      activity = await Activity.findOne({
        _id: activityId,
        student: student._id,
        school: req.user.schoolId
      });
    } else {
      // It's a UUID (batchId), find the activity for this student in this batch
      activity = await Activity.findOne({
        batchId: activityId,
        student: student._id,
        school: req.user.schoolId
      });
    }
    
    if (!activity) {
      return res.status(404).json({
        success: false,
        message: `Activity not found for student ${student.name}`
      });
    }
    
    console.log("Found activity:", activity._id, "with batchId:", activity.batchId);
    
    const parsedScore = parseFloat(score);
    if (parsedScore < 0 || parsedScore > activity.maxScore) {
      return res.status(400).json({
        success: false,
        message: `Score must be between 0 and ${activity.maxScore}`
      });
    }
    
    activity.score = parsedScore;
    activity.percentage = calculatePercentage(parsedScore, activity.maxScore);
    await activity.save();
    
    console.log("Updated score for student:", student.name, "Score:", parsedScore);
    
    res.json({
      success: true,
      message: "Score updated successfully",
      activity
    });
  } catch (error) {
    console.error("Update student score error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message || "Failed to update score" 
    });
  }
};

// ==================== GET STUDENT ACTIVITIES ====================

exports.getStudentActivities = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { term } = req.query;
    
    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Student ID is required"
      });
    }
    
    // Find the student by their MongoDB _id or display ID
    let student;
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(studentId);
    
    if (isObjectId) {
      student = await Student.findOne({ _id: studentId, school: req.user.schoolId });
    } else {
      student = await Student.findOne({ studentId: studentId, school: req.user.schoolId });
    }
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }
    
    const filter = {
      student: student._id,
      school: req.user.schoolId
    };
    
    if (term) filter.term = term;
    
    const activities = await Activity.find(filter)
      .populate("course", "courseName courseCode")
      .sort({ date: -1 });
    
    const total = activities.length;
    const scores = activities.map(a => a.percentage);
    const average = total > 0 ? parseFloat((scores.reduce((a, b) => a + b, 0) / total).toFixed(1)) : 0;
    const highest = total > 0 ? Math.max(...scores) : 0;
    const lowest = total > 0 ? Math.min(...scores) : 0;
    
    const byType = {};
    activities.forEach(a => {
      if (!byType[a.activityType]) {
        byType[a.activityType] = { total: 0, count: 0, scores: [] };
      }
      byType[a.activityType].total += a.percentage;
      byType[a.activityType].count++;
      byType[a.activityType].scores.push(a.percentage);
    });
    
    const typeStats = Object.keys(byType).map(key => ({
      type: key,
      average: byType[key].count > 0 ? parseFloat((byType[key].total / byType[key].count).toFixed(1)) : 0,
      count: byType[key].count,
      highest: byType[key].scores.length > 0 ? Math.max(...byType[key].scores) : 0,
      lowest: byType[key].scores.length > 0 ? Math.min(...byType[key].scores) : 0
    }));
    
    res.json({
      success: true,
      studentId: student.studentId,
      statistics: {
        totalActivities: total,
        averageScore: average,
        highestScore: highest,
        lowestScore: lowest,
        byType: typeStats
      },
      activities
    });
  } catch (error) {
    console.error("Get student activities error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ==================== GET CLASS PERFORMANCE DASHBOARD ====================

exports.getClassPerformanceDashboard = async (req, res) => {
  try {
    const { grade, className, term } = req.query;
    
    if (!grade || !className || !term) {
      return res.status(400).json({ 
        success: false,
        message: "Grade, class name, and term are required" 
      });
    }
    
    const filter = { 
      school: req.user.schoolId, 
      term,
      grade,
      className
    };
    
    const activities = await Activity.find(filter).populate("course", "courseName");
    const students = await Student.find({ 
      grade, 
      className, 
      school: req.user.schoolId,
      status: "ACTIVE",
      isDeleted: false 
    });
    
    // Activity type stats
    const activityTypeStats = {
      EXERCISE: { total: 0, count: 0, scores: [] },
      QUIZ: { total: 0, count: 0, scores: [] },
      HOMEWORK: { total: 0, count: 0, scores: [] },
      EXAM: { total: 0, count: 0, scores: [] }
    };
    
    (activities || []).forEach(a => {
      if (activityTypeStats[a.activityType]) {
        activityTypeStats[a.activityType].total += a.percentage;
        activityTypeStats[a.activityType].count++;
        activityTypeStats[a.activityType].scores.push(a.percentage);
      }
    });
    
    const activityAverages = {};
    Object.keys(activityTypeStats).forEach(key => {
      const data = activityTypeStats[key];
      activityAverages[key] = {
        average: data.count > 0 ? parseFloat((data.total / data.count).toFixed(1)) : 0,
        count: data.count,
        highest: data.scores.length > 0 ? Math.max(...data.scores) : 0,
        lowest: data.scores.length > 0 ? Math.min(...data.scores) : 0
      };
    });
    
    // Course performance
    const coursePerformance = {};
    (activities || []).forEach(a => {
      const courseName = a.courseName || "Unknown";
      if (!coursePerformance[courseName]) {
        coursePerformance[courseName] = { 
          total: 0, 
          count: 0, 
          scores: [],
          activities: []
        };
      }
      coursePerformance[courseName].total += a.percentage;
      coursePerformance[courseName].count++;
      coursePerformance[courseName].scores.push(a.percentage);
      coursePerformance[courseName].activities.push({
        title: a.title,
        type: a.activityType,
        date: a.date,
        average: a.percentage
      });
    });
    
    const courseStats = Object.entries(coursePerformance).map(([name, data]) => ({
      courseName: name,
      averageScore: data.count > 0 ? parseFloat((data.total / data.count).toFixed(1)) : 0,
      totalActivities: data.count,
      highest: data.scores.length > 0 ? Math.max(...data.scores) : 0,
      lowest: data.scores.length > 0 ? Math.min(...data.scores) : 0,
      recentActivities: data.activities.slice(-5).reverse()
    }));
    
    // Student ranking
    const studentAverages = {};
    (activities || []).forEach(a => {
      const key = a.studentId || a.studentName;
      if (!studentAverages[key]) {
        studentAverages[key] = { 
          name: a.studentName, 
          studentId: a.studentId,
          total: 0, 
          count: 0,
          scores: [],
          activities: []
        };
      }
      studentAverages[key].total += a.percentage;
      studentAverages[key].count++;
      studentAverages[key].scores.push(a.percentage);
      studentAverages[key].activities.push({
        title: a.title,
        type: a.activityType,
        score: a.percentage,
        date: a.date
      });
    });
    
    const studentRanking = Object.values(studentAverages).map(data => ({
      studentName: data.name,
      studentId: data.studentId,
      average: data.count > 0 ? parseFloat((data.total / data.count).toFixed(1)) : 0,
      totalActivities: data.count,
      highestScore: data.scores.length > 0 ? Math.max(...data.scores) : 0,
      lowestScore: data.scores.length > 0 ? Math.min(...data.scores) : 0,
      recentActivities: data.activities.slice(-3).reverse()
    })).sort((a, b) => b.average - a.average);
    
    // Grade distribution
    const gradeDistribution = {
      Excellent: studentRanking.filter(s => s.average >= 80).length,
      Good: studentRanking.filter(s => s.average >= 70 && s.average < 80).length,
      Average: studentRanking.filter(s => s.average >= 50 && s.average < 70).length,
      Poor: studentRanking.filter(s => s.average < 50).length
    };
    
    // Trend data
    const trendData = {};
    (activities || []).forEach(a => {
      const dateKey = a.date.toISOString().split('T')[0];
      if (!trendData[dateKey]) {
        trendData[dateKey] = { 
          date: dateKey, 
          total: 0, 
          count: 0,
          scores: [],
          activities: []
        };
      }
      trendData[dateKey].total += a.percentage;
      trendData[dateKey].count++;
      trendData[dateKey].scores.push(a.percentage);
      trendData[dateKey].activities.push({
        title: a.title,
        type: a.activityType,
        score: a.percentage
      });
    });
    
    const trendChartData = Object.entries(trendData)
      .map(([date, data]) => ({
        date,
        average: data.count > 0 ? parseFloat((data.total / data.count).toFixed(1)) : 0,
        count: data.count,
        highest: data.scores.length > 0 ? Math.max(...data.scores) : 0,
        lowest: data.scores.length > 0 ? Math.min(...data.scores) : 0
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);
    
    res.json({
      success: true,
      classInfo: { 
        grade, 
        className, 
        totalStudents: students.length,
        totalActivities: activities.length
      },
      activityTypeStats: activityAverages,
      coursePerformance: courseStats,
      studentRanking: studentRanking,
      gradeDistribution,
      trendChartData,
      summary: {
        overallAverage: activities.length > 0 
          ? parseFloat((activities.reduce((sum, a) => sum + a.percentage, 0) / activities.length).toFixed(1))
          : 0,
        passRate: studentRanking.filter(s => s.average >= 50).length > 0
          ? parseFloat(((studentRanking.filter(s => s.average >= 50).length / studentRanking.length) * 100).toFixed(1))
          : 0,
        totalActivities: activities.length,
        activityTypes: Object.keys(activityAverages).length
      }
    });
  } catch (error) {
    console.error("Get class performance dashboard error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ==================== GET ACTIVITY TRENDS ====================

exports.getActivityTrends = async (req, res) => {
  try {
    const { grade, className, courseId, activityType, startDate, endDate } = req.query;
    
    if (!grade || !className) {
      return res.status(400).json({
        success: false,
        message: "Grade and class name are required"
      });
    }
    
    const filter = {
      school: req.user.schoolId,
      grade,
      className
    };
    
    if (courseId) filter.course = courseId;
    if (activityType) filter.activityType = activityType;
    if (startDate && endDate) {
      filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    
    const activities = await Activity.find(filter)
      .populate("course", "courseName")
      .sort({ date: 1 });
    
    // Group by date
    const dailyData = {};
    activities.forEach(a => {
      const dateKey = a.date.toISOString().split('T')[0];
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = {
          date: dateKey,
          total: 0,
          count: 0,
          scores: [],
          byType: {}
        };
      }
      dailyData[dateKey].total += a.percentage;
      dailyData[dateKey].count++;
      dailyData[dateKey].scores.push(a.percentage);
      
      if (!dailyData[dateKey].byType[a.activityType]) {
        dailyData[dateKey].byType[a.activityType] = { total: 0, count: 0 };
      }
      dailyData[dateKey].byType[a.activityType].total += a.percentage;
      dailyData[dateKey].byType[a.activityType].count++;
    });
    
    const trendData = Object.values(dailyData).map(day => ({
      date: day.date,
      average: day.count > 0 ? parseFloat((day.total / day.count).toFixed(1)) : 0,
      count: day.count,
      highest: day.scores.length > 0 ? Math.max(...day.scores) : 0,
      lowest: day.scores.length > 0 ? Math.min(...day.scores) : 0,
      byType: Object.keys(day.byType).map(type => ({
        type,
        average: day.byType[type].count > 0 
          ? parseFloat((day.byType[type].total / day.byType[type].count).toFixed(1)) 
          : 0,
        count: day.byType[type].count
      }))
    }));
    
    // Calculate moving average (7-day)
    const withMovingAvg = trendData.map((day, index) => {
      if (index < 6) return { ...day, movingAverage: day.average };
      const last7 = trendData.slice(index - 6, index + 1);
      const avg = last7.reduce((sum, d) => sum + d.average, 0) / last7.length;
      return { ...day, movingAverage: parseFloat(avg.toFixed(1)) };
    });
    
    res.json({
      success: true,
      trendData: withMovingAvg,
      summary: {
        totalDays: trendData.length,
        overallAverage: activities.length > 0 
          ? parseFloat((activities.reduce((sum, a) => sum + a.percentage, 0) / activities.length).toFixed(1))
          : 0,
        totalActivities: activities.length,
        improvement: trendData.length > 1 
          ? parseFloat((trendData[trendData.length - 1].average - trendData[0].average).toFixed(1))
          : 0
      }
    });
  } catch (error) {
    console.error("Get activity trends error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ==================== LEGACY FUNCTIONS ====================

exports.createActivity = async (req, res) => {
  try {
    console.log("=== CREATE ACTIVITY (Legacy) ===");
    console.log("Request body:", req.body);
    console.log("User:", req.user);
    
    const { studentId, courseId, activityType, title, description, score, maxScore, date, term } = req.body;
    
    if (!studentId || !courseId || !activityType || !title || score === undefined || !term) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing required fields" 
      });
    }
    
    // Find student by _id or studentId
    let student;
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(studentId);
    
    if (isObjectId) {
      student = await Student.findOne({ _id: studentId, school: req.user.schoolId });
    } else {
      student = await Student.findOne({ studentId: studentId, school: req.user.schoolId });
    }
    
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }
    
    const course = await Course.findOne({ _id: courseId, school: req.user.schoolId });
    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }
    
    const parsedScore = parseFloat(score);
    const parsedMaxScore = parseFloat(maxScore) || 100;
    
    if (parsedScore < 0 || parsedScore > parsedMaxScore) {
      return res.status(400).json({ 
        success: false, 
        message: `Score must be between 0 and ${parsedMaxScore}` 
      });
    }
    
    const percentage = calculatePercentage(parsedScore, parsedMaxScore);
    
    const activityData = {
      student: student._id,
      studentName: student.name,
      studentId: student.studentId,
      grade: student.grade,
      className: student.className,
      course: courseId,
      courseName: course.courseName,
      activityType,
      title: title.trim(),
      description: description || "",
      score: parsedScore,
      maxScore: parsedMaxScore,
      percentage: percentage,
      date: date || new Date(),
      term,
      academicYear: new Date().getFullYear(),
      semester: term,
      recordedBy: req.user.id,
      recordedByName: req.user.name || req.user.email || "Unknown",
      school: req.user.schoolId,
      batchId: null
    };
    
    const activity = new Activity(activityData);
    await activity.save();
    
    const populatedActivity = await Activity.findById(activity._id)
      .populate("student", "name studentId")
      .populate("course", "courseName courseCode");
    
    res.status(201).json({
      success: true,
      message: "Activity recorded",
      activity: populatedActivity || activity
    });
  } catch (error) {
    console.error("Create activity error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message || "Failed to create activity" 
    });
  }
};

exports.getActivities = async (req, res) => {
  try {
    const { studentId, courseId, activityType, term, grade, className } = req.query;
    let filter = { school: req.user.schoolId };
    
    if (studentId) {
      let student;
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(studentId);
      
      if (isObjectId) {
        student = await Student.findOne({ _id: studentId, school: req.user.schoolId });
      } else {
        student = await Student.findOne({ studentId: studentId, school: req.user.schoolId });
      }
      
      if (student) {
        filter.student = student._id;
      } else {
        return res.json({
          success: true,
          activities: [],
          count: 0
        });
      }
    }
    
    if (courseId) filter.course = courseId;
    if (activityType) filter.activityType = activityType;
    if (term) filter.term = term;
    if (grade) filter.grade = grade;
    if (className) filter.className = className;
    
    const activities = await Activity.find(filter)
      .populate("student", "name studentId")
      .populate("course", "courseName courseCode")
      .sort({ date: -1 });
    
    res.json({
      success: true,
      activities: activities || [],
      count: (activities || []).length
    });
  } catch (error) {
    console.error("Get activities error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message,
      activities: [],
      count: 0
    });
  }
};

exports.getStudentPerformanceByCourse = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { term } = req.query;
    
    if (!term) {
      return res.status(400).json({
        success: false,
        message: "Term is required"
      });
    }
    
    // Find student by _id or studentId
    let student;
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(studentId);
    
    if (isObjectId) {
      student = await Student.findOne({ _id: studentId, school: req.user.schoolId });
    } else {
      student = await Student.findOne({ studentId: studentId, school: req.user.schoolId });
    }
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }
    
    const activities = await Activity.find({
      student: student._id,
      term,
      school: req.user.schoolId
    }).populate("course", "courseName");
    
    // Group by course
    const byCourse = {};
    (activities || []).forEach(a => {
      const courseName = a.course?.courseName || "Unknown";
      if (!byCourse[courseName]) {
        byCourse[courseName] = {
          courseName,
          exercises: [],
          quizzes: [],
          homeworks: [],
          exams: [],
          allScores: [],
          totalScores: 0,
          count: 0,
          average: 0
        };
      }
      
      const typeKey = a.activityType.toLowerCase() + 's';
      if (byCourse[courseName][typeKey]) {
        byCourse[courseName][typeKey].push(a.percentage);
      }
      byCourse[courseName].allScores.push(a.percentage);
      byCourse[courseName].totalScores += a.percentage;
      byCourse[courseName].count++;
      byCourse[courseName].average = byCourse[courseName].totalScores / byCourse[courseName].count;
    });
    
    const coursePerformance = Object.values(byCourse).map(course => ({
      ...course,
      average: parseFloat(course.average.toFixed(1)),
      exercisesAvg: course.exercises.length > 0 ? parseFloat((course.exercises.reduce((a, b) => a + b, 0) / course.exercises.length).toFixed(1)) : 0,
      quizzesAvg: course.quizzes.length > 0 ? parseFloat((course.quizzes.reduce((a, b) => a + b, 0) / course.quizzes.length).toFixed(1)) : 0,
      homeworksAvg: course.homeworks.length > 0 ? parseFloat((course.homeworks.reduce((a, b) => a + b, 0) / course.homeworks.length).toFixed(1)) : 0,
      examsAvg: course.exams.length > 0 ? parseFloat((course.exams.reduce((a, b) => a + b, 0) / course.exams.length).toFixed(1)) : 0
    }));
    
    res.json({
      success: true,
      studentId: student.studentId,
      term,
      coursePerformance,
      overallAverage: coursePerformance.length > 0 
        ? parseFloat((coursePerformance.reduce((sum, c) => sum + c.average, 0) / coursePerformance.length).toFixed(1))
        : 0
    });
  } catch (error) {
    console.error("Get student performance error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message,
      coursePerformance: [],
      overallAverage: 0
    });
  }
};

exports.getCoursePerformanceAnalysis = async (req, res) => {
  try {
    const { courseId, term, grade, className } = req.query;
    
    if (!courseId || !term) {
      return res.status(400).json({ 
        success: false,
        message: "Course ID and term are required" 
      });
    }
    
    let filter = {
      course: courseId,
      term,
      school: req.user.schoolId
    };
    
    if (grade) filter.grade = grade;
    if (className) filter.className = className;
    
    const activities = await Activity.find(filter);
    const course = await Course.findById(courseId);
    
    if (!course) {
      return res.status(404).json({ 
        success: false,
        message: "Course not found" 
      });
    }
    
    const byClass = {};
    (activities || []).forEach(a => {
      const key = `${a.grade} - ${a.className}`;
      if (!byClass[key]) {
        byClass[key] = { 
          total: 0, 
          count: 0, 
          students: new Set(),
          scores: []
        };
      }
      byClass[key].total += a.percentage;
      byClass[key].count++;
      byClass[key].students.add(a.studentId);
      byClass[key].scores.push(a.percentage);
    });
    
    const classPerformance = Object.entries(byClass).map(([className, data]) => ({
      className,
      averageScore: parseFloat((data.total / data.count).toFixed(1)),
      studentCount: data.students.size,
      totalActivities: data.count,
      median: data.scores.sort((a, b) => a - b)[Math.floor(data.scores.length / 2)] || 0
    }));
    
    const weaknessByType = {
      EXERCISE: { total: 0, count: 0, scores: [] },
      QUIZ: { total: 0, count: 0, scores: [] },
      HOMEWORK: { total: 0, count: 0, scores: [] },
      EXAM: { total: 0, count: 0, scores: [] }
    };
    
    (activities || []).forEach(a => {
      if (weaknessByType[a.activityType]) {
        weaknessByType[a.activityType].total += a.percentage;
        weaknessByType[a.activityType].count++;
        weaknessByType[a.activityType].scores.push(a.percentage);
      }
    });
    
    const weaknessAnalysis = Object.entries(weaknessByType).map(([type, data]) => ({
      activityType: type,
      averageScore: data.count > 0 ? parseFloat((data.total / data.count).toFixed(1)) : 0,
      count: data.count,
      needsImprovement: data.count > 0 && (data.total / data.count) < 60,
      median: data.scores.length > 0 ? data.scores.sort((a, b) => a - b)[Math.floor(data.scores.length / 2)] : 0
    }));
    
    const overallAverage = activities.length > 0 
      ? parseFloat((activities.reduce((sum, a) => sum + a.percentage, 0) / activities.length).toFixed(1))
      : 0;
    
    const passRate = activities.length > 0
      ? parseFloat(((activities.filter(a => a.percentage >= 50).length / activities.length) * 100).toFixed(1))
      : 0;
    
    res.json({
      success: true,
      courseName: course.courseName,
      courseCode: course.courseCode,
      totalActivities: activities.length,
      overallAverage,
      passRate,
      classPerformance,
      weaknessAnalysis,
      recommendations: weaknessAnalysis
        .filter(w => w.needsImprovement)
        .map(w => `Students need more support in ${w.activityType.toLowerCase()} activities (average: ${w.averageScore}%)`),
      chartData: {
        activityTypePerformance: weaknessAnalysis.map(w => ({
          type: w.activityType,
          average: w.averageScore
        })),
        classPerformance: classPerformance.map(c => ({
          className: c.className,
          average: c.averageScore
        }))
      }
    });
  } catch (error) {
    console.error("Get course analysis error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

exports.getPerformanceReport = async (req, res) => {
  try {
    const { term, academicYear, grade, className } = req.query;
    
    let filter = { 
      school: req.user.schoolId, 
      term, 
      academicYear: parseInt(academicYear) 
    };
    if (grade) filter.grade = grade;
    if (className) filter.className = className;
    
    const activities = await Activity.find(filter).populate("course", "courseName");
    
    const performanceLevels = {
      excellent: (activities || []).filter(a => a.percentage >= 80).length,
      good: (activities || []).filter(a => a.percentage >= 70 && a.percentage < 80).length,
      average: (activities || []).filter(a => a.percentage >= 50 && a.percentage < 70).length,
      poor: (activities || []).filter(a => a.percentage < 50).length
    };
    
    const byCourse = {};
    (activities || []).forEach(a => {
      const courseName = a.courseName || "Unknown";
      if (!byCourse[courseName]) {
        byCourse[courseName] = { total: 0, count: 0 };
      }
      byCourse[courseName].total += a.percentage;
      byCourse[courseName].count++;
    });
    
    const courseAverages = Object.entries(byCourse).map(([name, data]) => ({
      courseName: name,
      average: parseFloat((data.total / data.count).toFixed(1)),
      count: data.count
    }));
    
    const summary = {
      totalActivities: activities.length,
      totalStudents: new Set((activities || []).map(a => a.studentId)).size,
      overallAverage: activities.length > 0
        ? parseFloat((activities.reduce((sum, a) => sum + a.percentage, 0) / activities.length).toFixed(1))
        : 0,
      performanceLevels,
      passRate: activities.length > 0
        ? parseFloat(((activities.filter(a => a.percentage >= 50).length / activities.length) * 100).toFixed(1))
        : 0
    };
    
    res.json({
      success: true,
      summary,
      courseAverages,
      chartData: {
        performanceDistribution: Object.entries(performanceLevels).map(([level, count]) => ({ level, count })),
        coursePerformance: courseAverages
      },
      activities: (activities || []).slice(0, 100)
    });
  } catch (error) {
    console.error("Get performance report error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};