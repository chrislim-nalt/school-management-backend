const Homework = require("../models/Homework");
const Course = require("../models/Course");
const Teacher = require("../models/Teacher");
const Student = require("../models/Student");

// Assign homework (Teacher)
exports.assignHomework = async (req, res) => {
  try {
    const { courseId, grade, className, title, description, dueDate, attachments } = req.body;

    // --- Validation ---
    if (!courseId || !grade || !className || !title || !description || !dueDate) {
      return res.status(400).json({
        success: false,
        message: "All fields are required: courseId, grade, className, title, description, dueDate"
      });
    }

    // --- Find or create teacher ---
    let teacher = await Teacher.findOne({
      email: req.user.email,
      school: req.user.schoolId
    });

    if (!teacher && req.user.userType === "teacher") {
      const TeacherModel = require("../models/Teacher");
      const teacherId = await TeacherModel.generateTeacherId(req.user.schoolId);
      teacher = new TeacherModel({
        teacherId: teacherId,
        name: req.user.name,
        email: req.user.email,
        school: req.user.schoolId,
        status: "ACTIVE"
      });
      await teacher.save();
    }

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher record not found. Please contact your administrator."
      });
    }

    // --- Validate Course ---
    const course = await Course.findOne({ _id: courseId, school: req.user.schoolId });
    if (!course) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }

    // --- Create Homework ---
    const homework = new Homework({
      teacher: teacher._id,
      teacherName: teacher.name,
      course: courseId,
      courseName: course.courseName,
      grade,
      className,
      title,
      description,
      dueDate: new Date(dueDate),
      attachments: attachments || [],
      school: req.user.schoolId
    });

    await homework.save();

    res.status(201).json({
      success: true,
      message: "Homework assigned successfully",
      homework
    });
  } catch (error) {
    console.error("Assign homework error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get homeworks with filters
exports.getHomeworks = async (req, res) => {
  try {
    const { grade, className, startDate, endDate, status, courseId } = req.query;
    let filter = { school: req.user.schoolId };

    if (grade) filter.grade = grade;
    if (className) filter.className = className;
    if (courseId) filter.course = courseId;
    if (startDate && endDate) {
      filter.assignedDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    // If teacher, only show their assignments
    if (req.user.userType === "teacher" || req.user.userType === "staff") {
      const teacher = await Teacher.findOne({ email: req.user.email, school: req.user.schoolId });
      if (teacher) {
        filter.teacher = teacher._id;
      } else {
        // Teacher not found, return empty array
        return res.json({ success: true, homeworks: [], count: 0 });
      }
    }

    const homeworks = await Homework.find(filter)
      .populate("teacher", "name teacherId")
      .populate("course", "courseName courseCode")
      .sort({ assignedDate: -1 });

    // Always return an array
    res.json({
      success: true,
      homeworks: homeworks || [],
      count: (homeworks || []).length
    });
  } catch (error) {
    console.error("Get homeworks error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
      homeworks: [],
      count: 0
    });
  }
};

// Get homework submissions with student details
exports.getHomeworkSubmissions = async (req, res) => {
  try {
    const { homeworkId } = req.params;

    const homework = await Homework.findOne({ _id: homeworkId, school: req.user.schoolId });
    if (!homework) {
      return res.status(404).json({ success: false, message: "Homework not found" });
    }

    // Get all students in that class
    const students = await Student.find({
      grade: homework.grade,
      className: homework.className,
      school: req.user.schoolId,
      status: "ACTIVE",
      isDeleted: false
    });

    // Map submissions to students
    const submissionsWithStudents = students.map(student => {
      const submission = homework.submissions.find(s =>
        s.student && s.student.toString() === student._id.toString()
      );
      return {
        studentId: student.studentId,
        studentName: student.name,
        submitted: !!submission,
        submittedAt: submission?.submittedAt,
        score: submission?.score,
        feedback: submission?.feedback,
        status: submission?.status || "PENDING"
      };
    });

    // Calculate statistics
    const submitted = homework.submissions.length;
    const graded = homework.submissions.filter(s => s.status === "GRADED").length;
    const total = students.length;

    const avgScore = homework.submissions
      .filter(s => s.score !== undefined && s.score !== null)
      .reduce((sum, s) => sum + s.score, 0);
    const avgScoreValue = homework.submissions.filter(s => s.score !== undefined && s.score !== null).length > 0
      ? (avgScore / homework.submissions.filter(s => s.score !== undefined && s.score !== null).length).toFixed(1)
      : 0;

    res.json({
      success: true,
      homework: {
        id: homework._id,
        title: homework.title,
        description: homework.description,
        dueDate: homework.dueDate,
        assignedDate: homework.assignedDate,
        teacherName: homework.teacherName,
        courseName: homework.courseName
      },
      summary: {
        totalStudents: total,
        submitted,
        pending: total - submitted,
        graded,
        averageScore: avgScoreValue,
        completionRate: total > 0 ? ((submitted / total) * 100).toFixed(1) : 0
      },
      submissions: submissionsWithStudents
    });
  } catch (error) {
    console.error("Get homework submissions error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Submit homework (Student)
exports.submitHomework = async (req, res) => {
  try {
    const { homeworkId, studentId, content, attachments } = req.body;

    if (!homeworkId || !studentId) {
      return res.status(400).json({
        success: false,
        message: "Homework ID and Student ID are required"
      });
    }

    const homework = await Homework.findOne({ _id: homeworkId, school: req.user.schoolId });
    if (!homework) {
      return res.status(404).json({ success: false, message: "Homework not found" });
    }

    // Check if student is enrolled in that class
    const student = await Student.findOne({ _id: studentId, school: req.user.schoolId });
    if (!student || student.grade !== homework.grade || student.className !== homework.className) {
      return res.status(400).json({
        success: false,
        message: "Student not enrolled in this class"
      });
    }

    // Check if already submitted
    const existingSubmission = homework.submissions.find(s =>
      s.student && s.student.toString() === studentId
    );
    if (existingSubmission && existingSubmission.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: "Homework already submitted"
      });
    }

    if (existingSubmission) {
      existingSubmission.submittedAt = new Date();
      existingSubmission.status = "SUBMITTED";
      existingSubmission.content = content;
      existingSubmission.attachments = attachments || [];
    } else {
      homework.submissions.push({
        student: studentId,
        studentName: student.name,
        submittedAt: new Date(),
        status: "SUBMITTED",
        content: content || "",
        attachments: attachments || []
      });
    }

    await homework.save();

    res.json({
      success: true,
      message: "Homework submitted successfully"
    });
  } catch (error) {
    console.error("Submit homework error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Grade homework (Teacher)
exports.gradeHomework = async (req, res) => {
  try {
    const { homeworkId, studentId, score, feedback } = req.body;

    if (!homeworkId || !studentId || score === undefined) {
      return res.status(400).json({
        success: false,
        message: "Homework ID, Student ID, and score are required"
      });
    }

    const homework = await Homework.findOne({ _id: homeworkId, school: req.user.schoolId });
    if (!homework) {
      return res.status(404).json({ success: false, message: "Homework not found" });
    }

    const submission = homework.submissions.find(s =>
      s.student && s.student.toString() === studentId
    );
    if (!submission) {
      return res.status(404).json({ success: false, message: "Submission not found" });
    }

    submission.score = parseFloat(score);
    if (feedback) submission.feedback = feedback;
    submission.status = "GRADED";

    await homework.save();

    res.json({
      success: true,
      message: "Homework graded successfully"
    });
  } catch (error) {
    console.error("Grade homework error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get homework report with analytics
exports.getHomeworkReport = async (req, res) => {
  try {
    const { grade, className, startDate, endDate, teacherId } = req.query;

    let filter = { school: req.user.schoolId };
    if (grade) filter.grade = grade;
    if (className) filter.className = className;
    if (teacherId) filter.teacher = teacherId;
    if (startDate && endDate) {
      filter.assignedDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    // If teacher, only show their assignments
    if (req.user.userType === "teacher" || req.user.userType === "staff") {
      const teacher = await Teacher.findOne({ email: req.user.email, school: req.user.schoolId });
      if (teacher) {
        filter.teacher = teacher._id;
      }
    }

    const homeworks = await Homework.find(filter)
      .populate("teacher", "name teacherId")
      .populate("course", "courseName")
      .sort({ assignedDate: -1 });

    // Summary statistics
    const totalSubmissions = homeworks.reduce((sum, h) => sum + h.submissions.length, 0);
    const totalGraded = homeworks.reduce((sum, h) => sum + h.submissions.filter(s => s.status === "GRADED").length, 0);

    // Calculate average completion rate
    let totalCompletionRate = 0;
    homeworks.forEach(h => {
      const students = h.submissions.length > 0 ? h.submissions.length + 1 : 1;
      const rate = (h.submissions.length / students) * 100;
      totalCompletionRate += rate;
    });
    const avgCompletionRate = homeworks.length > 0 ? (totalCompletionRate / homeworks.length).toFixed(1) : 0;

    // Average score
    let totalScore = 0;
    let scoredCount = 0;
    homeworks.forEach(h => {
      const gradedSubmissions = h.submissions.filter(s => s.score !== undefined && s.score !== null);
      gradedSubmissions.forEach(s => {
        totalScore += s.score;
        scoredCount++;
      });
    });
    const avgScore = scoredCount > 0 ? (totalScore / scoredCount).toFixed(1) : 0;

    // By teacher
    const byTeacher = {};
    homeworks.forEach(h => {
      const name = h.teacherName || "Unknown";
      if (!byTeacher[name]) {
        byTeacher[name] = { total: 0, submissions: 0, graded: 0 };
      }
      byTeacher[name].total++;
      byTeacher[name].submissions += h.submissions.length;
      byTeacher[name].graded += h.submissions.filter(s => s.status === "GRADED").length;
    });

    // By course
    const byCourse = {};
    homeworks.forEach(h => {
      const courseName = h.courseName || "Unknown";
      if (!byCourse[courseName]) {
        byCourse[courseName] = { total: 0, totalScore: 0, scoredCount: 0 };
      }
      byCourse[courseName].total++;
      const gradedSubmissions = h.submissions.filter(s => s.score !== undefined && s.score !== null);
      gradedSubmissions.forEach(s => {
        byCourse[courseName].totalScore += s.score || 0;
        byCourse[courseName].scoredCount++;
      });
    });

    // Calculate course averages
    const courseAverages = Object.entries(byCourse).map(([name, data]) => ({
      courseName: name,
      totalAssignments: data.total,
      averageScore: data.scoredCount > 0 ? (data.totalScore / data.scoredCount).toFixed(1) : 0
    }));

    // Chart data
    const chartData = {
      monthlyTrend: {},
      statusDistribution: [
        { label: "Submitted", value: totalSubmissions },
        { label: "Graded", value: totalGraded },
        { label: "Pending", value: totalSubmissions - totalGraded }
      ]
    };

    // Monthly trend
    homeworks.forEach(h => {
      const month = h.assignedDate.toISOString().substring(0, 7);
      if (!chartData.monthlyTrend[month]) {
        chartData.monthlyTrend[month] = { total: 0, submissions: 0 };
      }
      chartData.monthlyTrend[month].total++;
      chartData.monthlyTrend[month].submissions += h.submissions.length;
    });

    chartData.monthlyTrend = Object.entries(chartData.monthlyTrend).map(([month, data]) => ({
      month,
      ...data
    })).sort((a, b) => a.month.localeCompare(b.month));

    res.json({
      success: true,
      summary: {
        totalAssignments: homeworks.length,
        totalSubmissions,
        totalGraded,
        averageCompletionRate: avgCompletionRate,
        averageScore: avgScore,
        submissionRate: homeworks.length > 0
          ? ((totalSubmissions / (homeworks.length * 30)) * 100).toFixed(1)
          : 0
      },
      byTeacher,
      byCourse: courseAverages,
      chartData,
      homeworks: homeworks.map(h => ({
        id: h._id,
        title: h.title,
        courseName: h.courseName,
        teacherName: h.teacherName,
        grade: h.grade,
        className: h.className,
        assignedDate: h.assignedDate,
        dueDate: h.dueDate,
        submissionsCount: h.submissions.length,
        gradedCount: h.submissions.filter(s => s.status === "GRADED").length,
        averageScore: h.submissions.filter(s => s.score !== undefined && s.score !== null).length > 0
          ? (h.submissions.filter(s => s.score !== undefined && s.score !== null).reduce((sum, s) => sum + s.score, 0) /
             h.submissions.filter(s => s.score !== undefined && s.score !== null).length).toFixed(1)
          : 0
      }))
    });
  } catch (error) {
    console.error("Get homework report error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get homework summary for dashboard
exports.getHomeworkSummary = async (req, res) => {
  try {
    const { grade, className } = req.query;
    let filter = { school: req.user.schoolId };
    if (grade) filter.grade = grade;
    if (className) filter.className = className;

    const homeworks = await Homework.find(filter);

    const total = homeworks.length;
    const pending = homeworks.filter(h => {
      const now = new Date();
      return h.dueDate > now && h.submissions.length === 0;
    }).length;
    const overdue = homeworks.filter(h => {
      const now = new Date();
      return h.dueDate < now && h.submissions.length === 0;
    }).length;
    const completed = homeworks.filter(h => h.submissions.length > 0).length;

    res.json({
      success: true,
      summary: { total, pending, overdue, completed },
      recentHomeworks: homeworks.slice(0, 5).map(h => ({
        id: h._id,
        title: h.title,
        dueDate: h.dueDate,
        submissions: h.submissions.length
      }))
    });
  } catch (error) {
    console.error("Get homework summary error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
      summary: { total: 0, pending: 0, overdue: 0, completed: 0 },
      recentHomeworks: []
    });
  }
};