const Homework = require("../models/Homework");
const Course = require("../models/Course");
const Teacher = require("../models/Teacher");
const Student = require("../models/Student");

// Assign homework (Teacher)
exports.assignHomework = async (req, res) => {
  try {
    const { courseId, grade, className, title, description, dueDate, attachments } = req.body;
    
    const teacher = await Teacher.findOne({ email: req.user.email, school: req.user.schoolId });
    if (!teacher) {
      return res.status(404).json({ message: "Teacher record not found" });
    }
    
    const course = await Course.findOne({ _id: courseId, school: req.user.schoolId });
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }
    
    const homework = new Homework({
      teacher: teacher._id,
      teacherName: teacher.name,
      course: courseId,
      courseName: course.courseName,
      grade,
      className,
      title,
      description,
      dueDate,
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
    res.status(500).json({ message: error.message });
  }
};

// Get homeworks (Teacher - my assignments, School Admin - all)
exports.getHomeworks = async (req, res) => {
  try {
    const { grade, className, startDate, endDate, status } = req.query;
    let filter = { school: req.user.schoolId };
    
    if (grade) filter.grade = grade;
    if (className) filter.className = className;
    if (startDate && endDate) {
      filter.assignedDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    
    // If teacher, only show their assignments
    if (req.user.userType === "teacher") {
      const teacher = await Teacher.findOne({ email: req.user.email, school: req.user.schoolId });
      if (teacher) {
        filter.teacher = teacher._id;
      }
    }
    
    const homeworks = await Homework.find(filter)
      .populate("teacher", "name teacherId")
      .populate("course", "courseName courseCode")
      .sort({ assignedDate: -1 });
    
    res.json(homeworks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get homework submissions (Teacher/School Admin)
exports.getHomeworkSubmissions = async (req, res) => {
  try {
    const { homeworkId } = req.params;
    
    const homework = await Homework.findOne({ _id: homeworkId, school: req.user.schoolId });
    if (!homework) {
      return res.status(404).json({ message: "Homework not found" });
    }
    
    // Get all students in that class
    const students = await Student.find({
      grade: homework.grade,
      className: homework.className,
      school: req.user.schoolId,
      status: "ACTIVE"
    });
    
    // Map submissions to students
    const submissionsWithStudents = students.map(student => {
      const submission = homework.submissions.find(s => s.student.toString() === student._id.toString());
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
    
    res.json({
      homework: {
        title: homework.title,
        description: homework.description,
        dueDate: homework.dueDate,
        assignedDate: homework.assignedDate
      },
      summary: {
        totalStudents: students.length,
        submitted: homework.submissions.length,
        pending: students.length - homework.submissions.length,
        graded: homework.submissions.filter(s => s.status === "GRADED").length
      },
      submissions: submissionsWithStudents
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Submit homework (Student - via teacher or API)
exports.submitHomework = async (req, res) => {
  try {
    const { homeworkId, studentId, content, attachments } = req.body;
    
    const homework = await Homework.findOne({ _id: homeworkId, school: req.user.schoolId });
    if (!homework) {
      return res.status(404).json({ message: "Homework not found" });
    }
    
    // Check if student is enrolled in that class
    const student = await Student.findOne({ _id: studentId, school: req.user.schoolId });
    if (!student || student.grade !== homework.grade || student.className !== homework.className) {
      return res.status(400).json({ message: "Student not enrolled in this class" });
    }
    
    // Check if already submitted
    const existingSubmission = homework.submissions.find(s => s.student.toString() === studentId);
    if (existingSubmission && existingSubmission.status !== "PENDING") {
      return res.status(400).json({ message: "Homework already submitted/graded" });
    }
    
    if (existingSubmission) {
      existingSubmission.submittedAt = new Date();
      existingSubmission.status = "SUBMITTED";
      // Update any additional submission data
    } else {
      homework.submissions.push({
        student: studentId,
        studentName: student.name,
        submittedAt: new Date(),
        status: "SUBMITTED"
      });
    }
    
    await homework.save();
    
    res.json({
      success: true,
      message: "Homework submitted successfully"
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Grade homework (Teacher)
exports.gradeHomework = async (req, res) => {
  try {
    const { homeworkId, studentId, score, feedback } = req.body;
    
    const homework = await Homework.findOne({ _id: homeworkId, school: req.user.schoolId });
    if (!homework) {
      return res.status(404).json({ message: "Homework not found" });
    }
    
    const submission = homework.submissions.find(s => s.student.toString() === studentId);
    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }
    
    submission.score = score;
    submission.feedback = feedback;
    submission.status = "GRADED";
    
    await homework.save();
    
    res.json({
      success: true,
      message: "Homework graded successfully"
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get homework report (professional)
exports.getHomeworkReport = async (req, res) => {
  try {
    const { grade, className, startDate, endDate } = req.query;
    
    let filter = { school: req.user.schoolId };
    if (grade) filter.grade = grade;
    if (className) filter.className = className;
    if (startDate && endDate) {
      filter.assignedDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    
    const homeworks = await Homework.find(filter)
      .populate("teacher", "name teacherId")
      .populate("course", "courseName")
      .sort({ assignedDate: -1 });
    
    // Summary statistics
    const summary = {
      totalAssignments: homeworks.length,
      totalSubmissions: homeworks.reduce((sum, h) => sum + h.submissions.length, 0),
      averageCompletionRate: homeworks.length > 0
        ? (homeworks.reduce((sum, h) => sum + (h.submissions.length / (h.submissions.length + 1)), 0) / homeworks.length * 100).toFixed(1)
        : 0,
      averageScore: homeworks.reduce((sum, h) => {
        const gradedSubmissions = h.submissions.filter(s => s.score !== undefined);
        const avgScore = gradedSubmissions.reduce((s, sub) => s + (sub.score || 0), 0) / (gradedSubmissions.length || 1);
        return sum + avgScore;
      }, 0) / (homeworks.length || 1)
    };
    
    // By teacher
    const byTeacher = {};
    homeworks.forEach(h => {
      if (!byTeacher[h.teacherName]) {
        byTeacher[h.teacherName] = { total: 0, submissions: 0 };
      }
      byTeacher[h.teacherName].total++;
      byTeacher[h.teacherName].submissions += h.submissions.length;
    });
    
    // By course
    const byCourse = {};
    homeworks.forEach(h => {
      const courseName = h.courseName;
      if (!byCourse[courseName]) {
        byCourse[courseName] = { total: 0, averageScore: 0, totalScore: 0 };
      }
      byCourse[courseName].total++;
      const gradedSubmissions = h.submissions.filter(s => s.score !== undefined);
      const courseAvg = gradedSubmissions.reduce((sum, s) => sum + (s.score || 0), 0) / (gradedSubmissions.length || 1);
      byCourse[courseName].totalScore += courseAvg;
      byCourse[courseName].averageScore = byCourse[courseName].totalScore / byCourse[courseName].total;
    });
    
    res.json({
      summary,
      byTeacher,
      byCourse,
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
        gradedCount: h.submissions.filter(s => s.status === "GRADED").length
      }))
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};