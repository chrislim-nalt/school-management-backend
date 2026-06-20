const Mark = require("../models/Mark");
const Student = require("../models/Student");
const Course = require("../models/Course");

// Helper function to calculate total and grade
const calculateMark = (ca, exam) => {
  const total = (ca || 0) + (exam || 0);
  let grade = "F";
  if (total >= 80) grade = "A";
  else if (total >= 70) grade = "B";
  else if (total >= 60) grade = "C";
  else if (total >= 50) grade = "D";
  return { total, grade };
};

// ==================== GET MARKS ====================

// Get all marks with filters
exports.getMarks = async (req, res) => {
  try {
    const { term, year, grade, className, course, student } = req.query;
    let filter = { school: req.user.schoolId };
    
    if (term) filter.term = term;
    if (year) filter.year = parseInt(year);
    if (course) filter.course = course;
    if (student) filter.student = student;
    
    let marks = await Mark.find(filter)
      .populate("student", "name studentId grade className")
      .populate("course", "courseName courseCode")
      .populate("recordedBy", "name");
    
    if (grade) {
      marks = (marks || []).filter(m => m.student?.grade === grade);
    }
    if (className) {
      marks = (marks || []).filter(m => m.student?.className === className);
    }
    
    res.json({
      success: true,
      marks: marks || [],
      count: (marks || []).length
    });
  } catch (error) {
    console.error("Get marks error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message,
      marks: [],
      count: 0
    });
  }
};

// Get students with marks for a specific class and course
exports.getClassMarks = async (req, res) => {
  try {
    const { grade, className, courseId, term, year } = req.query;
    
    console.log("=== getClassMarks ===");
    console.log("Params:", { grade, className, courseId, term, year });
    
    if (!grade || !className || !courseId) {
      return res.status(400).json({
        success: false,
        message: "Grade, class name, and course ID are required"
      });
    }
    
    // Get all students in the class
    const students = await Student.find({
      grade,
      className,
      school: req.user.schoolId,
      status: "ACTIVE",
      isDeleted: false
    });
    
    console.log(`Found ${students.length} students in class ${grade} ${className}`);
    
    if (students.length === 0) {
      return res.json({
        success: true,
        students: [],
        summary: {
          totalStudents: 0,
          withMarks: 0,
          averageScore: 0,
          passRate: 0,
          gradeDistribution: { A: 0, B: 0, C: 0, D: 0, F: 0 }
        }
      });
    }
    
    // Get existing marks for these students
    const studentIds = students.map(s => s._id);
    const marks = await Mark.find({
      student: { $in: studentIds },
      course: courseId,
      term: term || "TERM1",
      year: year || new Date().getFullYear(),
      school: req.user.schoolId
    }).populate("student", "name studentId grade className");
    
    console.log(`Found ${marks.length} existing marks for course ${courseId}`);
    
    // Create a map of student marks by studentId (display ID)
    const marksMap = {};
    marks.forEach(m => {
      if (m.student) {
        marksMap[m.student.studentId] = m;
      }
    });
    
    // Build response with student data and their marks
    const studentsWithMarks = students.map(student => {
      const mark = marksMap[student.studentId];
      return {
        studentId: student.studentId,
        studentName: student.name,
        grade: student.grade,
        className: student.className,
        markId: mark?._id || null,
        continuousAssessment: mark?.continuousAssessment || 0,
        examScore: mark?.examScore || 0,
        totalScore: mark?.totalScore || 0,
        grade: mark?.grade || "F",
        hasMark: !!mark
      };
    });
    
    // Calculate summary statistics
    const totalStudents = studentsWithMarks.length;
    const withMarks = studentsWithMarks.filter(s => s.hasMark).length;
    const totalScores = studentsWithMarks.filter(s => s.hasMark).reduce((sum, s) => sum + s.totalScore, 0);
    const averageScore = withMarks > 0 ? (totalScores / withMarks).toFixed(1) : 0;
    const passCount = studentsWithMarks.filter(s => s.hasMark && s.grade && s.grade !== "F").length;
    const passRate = withMarks > 0 ? ((passCount / withMarks) * 100).toFixed(1) : 0;
    
    const course = await Course.findById(courseId);
    
    res.json({
      success: true,
      course: {
        id: courseId,
        name: course?.courseName || "Unknown"
      },
      students: studentsWithMarks,
      summary: {
        totalStudents,
        withMarks,
        averageScore,
        passRate,
        gradeDistribution: {
          A: studentsWithMarks.filter(s => s.grade === "A").length,
          B: studentsWithMarks.filter(s => s.grade === "B").length,
          C: studentsWithMarks.filter(s => s.grade === "C").length,
          D: studentsWithMarks.filter(s => s.grade === "D").length,
          F: studentsWithMarks.filter(s => s.grade === "F").length
        }
      }
    });
  } catch (error) {
    console.error("Get class marks error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Get students for a specific class
exports.getClassStudents = async (req, res) => {
  try {
    const { grade, className } = req.query;
    
    if (!grade || !className) {
      return res.status(400).json({
        success: false,
        message: "Grade and class name are required"
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
      students: students || [],
      count: students.length
    });
  } catch (error) {
    console.error("Get class students error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Get student marks
exports.getStudentMarks = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { term, year } = req.query;
    
    console.log("=== getStudentMarks ===");
    console.log("Student ID:", studentId);
    
    // Find student by studentId (display ID)
    const student = await Student.findOne({ 
      studentId: studentId,
      school: req.user.schoolId 
    });
    
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
    if (year) filter.year = parseInt(year);
    
    const marks = await Mark.find(filter)
      .populate("course", "courseName courseCode coefficient")
      .sort({ createdAt: -1 });
    
    console.log(`Found ${marks.length} marks for student ${studentId}`);
    
    const totalMarks = marks.reduce((sum, m) => sum + m.totalScore, 0);
    const average = marks.length > 0 ? (totalMarks / marks.length).toFixed(1) : 0;
    
    const gradeDistribution = {
      A: marks.filter(m => m.grade === "A").length,
      B: marks.filter(m => m.grade === "B").length,
      C: marks.filter(m => m.grade === "C").length,
      D: marks.filter(m => m.grade === "D").length,
      F: marks.filter(m => m.grade === "F").length
    };
    
    res.json({
      success: true,
      studentId: studentId,
      studentName: student.name,
      totalMarks: marks.length,
      average,
      gradeDistribution,
      marks
    });
  } catch (error) {
    console.error("Get student marks error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ==================== CREATE/UPDATE MARKS ====================

// Bulk upsert marks for a class - FIXED with calculations in controller
exports.bulkUpsertClassMarks = async (req, res) => {
  try {
    const { marks, term, year, grade, className, courseId } = req.body;
    const results = [];
    const errors = [];
    
    console.log("=== bulkUpsertClassMarks ===");
    console.log("Class:", grade, className);
    console.log("Course:", courseId);
    console.log("Term:", term, "Year:", year);
    console.log("Marks data received:", JSON.stringify(marks, null, 2));
    
    if (!marks || marks.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: "No marks data provided" 
      });
    }
    
    if (!term || !year || !grade || !className || !courseId) {
      return res.status(400).json({ 
        success: false,
        message: "Term, year, grade, class name, and course ID are required" 
      });
    }
    
    // Verify course exists
    const course = await Course.findOne({ _id: courseId, school: req.user.schoolId });
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found"
      });
    }
    
    // Process each mark
    for (const mark of marks) {
      try {
        // Skip if no studentId
        if (!mark.studentId) {
          console.log("Skipping mark with no studentId");
          continue;
        }
        
        console.log(`Processing mark for studentId: ${mark.studentId}`);
        console.log(`CA: ${mark.continuousAssessment}, Exam: ${mark.examScore}`);
        
        // Find student by studentId (display ID)
        const student = await Student.findOne({ 
          studentId: mark.studentId,
          school: req.user.schoolId 
        });
        
        if (!student) {
          console.log(`Student not found with studentId: ${mark.studentId}`);
          errors.push({
            studentId: mark.studentId,
            error: "Student not found"
          });
          continue;
        }
        
        console.log(`Found student: ${student.name} (${student.studentId}) with _id: ${student._id}`);
        
        // Check if student belongs to the class
        if (student.grade !== grade || student.className !== className) {
          console.log(`Student ${student.name} is not in class ${grade} ${className}`);
          errors.push({
            studentId: mark.studentId,
            error: `Student ${student.name} is not in class ${grade} ${className}`
          });
          continue;
        }
        
        // Calculate total and grade in the controller (not in model)
        const ca = parseFloat(mark.continuousAssessment) || 0;
        const exam = parseFloat(mark.examScore) || 0;
        const { total, grade: letterGrade } = calculateMark(ca, exam);
        
        console.log(`Calculated: CA=${ca}, Exam=${exam}, Total=${total}, Grade=${letterGrade}`);
        
        // Check if mark already exists
        const existingMark = await Mark.findOne({
          student: student._id,
          course: courseId,
          term: term,
          year: parseInt(year),
          school: req.user.schoolId
        });
        
        // Build mark data with calculated values
        const markData = {
          student: student._id,
          course: courseId,
          term: term,
          year: parseInt(year),
          continuousAssessment: ca,
          examScore: exam,
          totalScore: total,
          grade: letterGrade,
          recordedBy: req.user.id,
          school: req.user.schoolId
        };
        
        let result;
        if (existingMark) {
          console.log(`Updating existing mark for student ${student.studentId}`);
          result = await Mark.findByIdAndUpdate(
            existingMark._id, 
            markData, 
            { new: true, runValidators: true }
          );
        } else {
          console.log(`Creating new mark for student ${student.studentId}`);
          result = await Mark.create(markData);
        }
        results.push(result);
        console.log(`Successfully saved mark for student ${student.studentId}`);
      } catch (error) {
        console.error(`Error processing mark for student ${mark.studentId}:`, error);
        errors.push({
          studentId: mark.studentId,
          error: error.message
        });
      }
    }
    
    console.log(`Successfully saved ${results.length} marks`);
    if (errors.length > 0) {
      console.log(`Errors: ${errors.length}`);
    }
    
    res.status(201).json({
      success: true,
      message: `Saved ${results.length} marks successfully`,
      results: results,
      errors: errors.length > 0 ? errors : undefined,
      count: results.length
    });
  } catch (error) {
    console.error("Bulk upsert class marks error:", error);
    res.status(400).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// Legacy: Bulk upsert marks
exports.bulkUpsertMarks = async (req, res) => {
  try {
    const { marks, term, year } = req.body;
    const results = [];
    const errors = [];
    
    if (!marks || marks.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: "No marks data provided" 
      });
    }
    
    if (!term || !year) {
      return res.status(400).json({ 
        success: false,
        message: "Term and year are required" 
      });
    }
    
    console.log(`Processing ${marks.length} marks for term ${term} ${year}`);
    
    for (const mark of marks) {
      try {
        // Find student by ID
        const student = await Student.findOne({ 
          _id: mark.studentId, 
          school: req.user.schoolId 
        });
        if (!student) {
          errors.push({
            studentId: mark.studentId,
            error: "Student not found"
          });
          continue;
        }
        
        // Calculate total and grade
        const ca = parseFloat(mark.continuousAssessment) || 0;
        const exam = parseFloat(mark.examScore) || 0;
        const { total, grade: letterGrade } = calculateMark(ca, exam);
        
        // Check if mark already exists
        const existingMark = await Mark.findOne({
          student: mark.studentId,
          course: mark.courseId,
          term,
          year: parseInt(year),
          school: req.user.schoolId
        });
        
        const markData = {
          student: mark.studentId,
          course: mark.courseId,
          term,
          year: parseInt(year),
          continuousAssessment: ca,
          examScore: exam,
          totalScore: total,
          grade: letterGrade,
          recordedBy: req.user.id,
          school: req.user.schoolId
        };
        
        let result;
        if (existingMark) {
          result = await Mark.findByIdAndUpdate(
            existingMark._id, 
            markData, 
            { new: true, runValidators: true }
          );
        } else {
          result = await Mark.create(markData);
        }
        results.push(result);
      } catch (error) {
        console.error(`Error processing mark for student ${mark.studentId}:`, error);
        errors.push({
          studentId: mark.studentId,
          error: error.message
        });
      }
    }
    
    res.status(201).json({
      success: true,
      message: `Saved ${results.length} marks successfully`,
      results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error("Bulk upsert marks error:", error);
    res.status(400).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ==================== ANALYTICS ====================

// Get marks analytics
exports.getMarksAnalytics = async (req, res) => {
  try {
    const { term, year, grade, className } = req.query;
    
    if (!term || !year) {
      return res.status(400).json({
        success: false,
        message: "Term and year are required"
      });
    }
    
    let filter = {
      term,
      year: parseInt(year),
      school: req.user.schoolId
    };
    
    let marks = await Mark.find(filter)
      .populate("student", "grade className")
      .populate("course", "courseName");
    
    if (grade) {
      marks = marks.filter(m => m.student?.grade === grade);
    }
    if (className) {
      marks = marks.filter(m => m.student?.className === className);
    }
    
    if (marks.length === 0) {
      return res.json({
        success: true,
        totalStudents: 0,
        totalMarks: 0,
        averageScore: 0,
        passRate: 0,
        gradeDistribution: { A: 0, B: 0, C: 0, D: 0, F: 0 },
        coursePerformance: []
      });
    }
    
    const totalStudents = new Set((marks || []).map(m => m.student?._id?.toString())).size;
    const totalMarks = marks.length;
    const totalScore = marks.reduce((sum, m) => sum + m.totalScore, 0);
    const averageScore = (totalScore / totalMarks).toFixed(1);
    
    const gradeDistribution = {
      A: (marks || []).filter(m => m.grade === "A").length,
      B: (marks || []).filter(m => m.grade === "B").length,
      C: (marks || []).filter(m => m.grade === "C").length,
      D: (marks || []).filter(m => m.grade === "D").length,
      F: (marks || []).filter(m => m.grade === "F").length
    };
    
    const passingMarks = marks.filter(m => ["A", "B", "C"].includes(m.grade));
    const passRate = ((passingMarks.length / totalMarks) * 100).toFixed(1);
    
    const performanceByCourse = {};
    marks.forEach(mark => {
      const courseName = mark.course?.courseName || "Unknown";
      if (!performanceByCourse[courseName]) {
        performanceByCourse[courseName] = { 
          total: 0, 
          count: 0,
          scores: []
        };
      }
      performanceByCourse[courseName].total += mark.totalScore;
      performanceByCourse[courseName].count += 1;
      performanceByCourse[courseName].scores.push(mark.totalScore);
    });
    
    const coursePerformance = Object.entries(performanceByCourse).map(([name, data]) => ({
      course: name,
      average: (data.total / data.count).toFixed(1),
      studentsCount: data.count,
      highest: Math.max(...data.scores),
      lowest: Math.min(...data.scores)
    }));
    
    res.json({
      success: true,
      totalStudents,
      totalMarks,
      averageScore,
      gradeDistribution,
      coursePerformance,
      passRate
    });
  } catch (error) {
    console.error("Get marks analytics error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ==================== DELETE ====================

// Delete a mark
exports.deleteMark = async (req, res) => {
  try {
    const { id } = req.params;
    
    const mark = await Mark.findOneAndDelete({
      _id: id,
      school: req.user.schoolId
    });
    
    if (!mark) {
      return res.status(404).json({ 
        success: false, 
        message: "Mark not found" 
      });
    }
    
    res.json({
      success: true,
      message: "Mark deleted successfully"
    });
  } catch (error) {
    console.error("Delete mark error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};