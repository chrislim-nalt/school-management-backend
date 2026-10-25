const Student = require("../models/Student");
const Mark = require("../models/Mark");
const Attendance = require("../models/Attendance");
const mongoose = require("mongoose");
const {
  MAX_IMPORT_ROWS,
  analyzeRows,
  summarize
} = require("../utils/studentImport");

// ==================== GET STUDENTS ====================

// Get all students
exports.getStudents = async (req, res) => {
  try {
    const { grade, className, status, search } = req.query;
    let filter = { school: req.user.schoolId, isDeleted: false };
    
    if (grade) filter.grade = grade;
    if (className) filter.className = className;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { studentId: { $regex: search, $options: 'i' } },
        { parentPhone: { $regex: search, $options: 'i' } }
      ];
    }
    
    const students = await Student.find(filter).sort({ name: 1 });
    res.json({
      success: true,
      students: students || [],
      count: (students || []).length
    });
  } catch (error) {
    console.error("Get students error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message,
      students: [],
      count: 0
    });
  }
};

// Get single student
exports.getStudentById = async (req, res) => {
  try {
    const student = await Student.findOne({ 
      _id: req.params.id, 
      school: req.user.schoolId,
      isDeleted: false
    });
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });
    res.json({ success: true, student });
  } catch (error) {
    console.error("Get student error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get students by class
exports.getStudentsByClass = async (req, res) => {
  try {
    const { grade, className } = req.query;
    
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
      grade,
      className,
      school: schoolId,
      status: "ACTIVE",
      isDeleted: false
    }).select("name studentId grade className gender parentPhone status");
    
    res.json({
      success: true,
      students: students || [],
      count: (students || []).length
    });
  } catch (error) {
    console.error("Get students by class error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message,
      students: [],
      count: 0
    });
  }
};

// Create student - Generate ID in controller with retry logic
exports.createStudent = async (req, res) => {
  try {
    console.log("=== CREATE STUDENT ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    
    // Validate required fields
    if (!req.body.name) {
      return res.status(400).json({ 
        success: false, 
        message: "Student name is required" 
      });
    }
    if (!req.body.grade) {
      return res.status(400).json({ 
        success: false, 
        message: "Grade is required" 
      });
    }
    if (!req.body.className) {
      return res.status(400).json({ 
        success: false, 
        message: "Class name is required" 
      });
    }
    
    // Check for duplicate student by name
    const existingStudent = await Student.findOne({
      name: req.body.name.trim(),
      grade: req.body.grade,
      className: req.body.className,
      school: req.user.schoolId,
      isDeleted: false
    });
    
    if (existingStudent) {
      return res.status(400).json({
        success: false,
        message: `Student "${req.body.name}" already exists in ${req.body.grade} ${req.body.className}`
      });
    }
    
    // GENERATE STUDENT ID WITH RETRY LOGIC
    const studentId = await Student.getNextStudentId(req.user.schoolId);
    console.log("Final student ID to use:", studentId);
    
    // Create student data WITH the generated studentId
    const studentData = {
      studentId: studentId,
      name: req.body.name.trim(),
      grade: req.body.grade,
      className: req.body.className,
      school: req.user.schoolId,
      dateOfBirth: req.body.dateOfBirth || null,
      gender: req.body.gender || "MALE",
      address: req.body.address || "",
      parentName: req.body.parentName || "",
      parentPhone: req.body.parentPhone || "",
      parentEmail: req.body.parentEmail || "",
      parentOccupation: req.body.parentOccupation || "",
      parentAddress: req.body.parentAddress || "",
      emergencyContact: req.body.emergencyContact || "",
      emergencyContactPhone: req.body.emergencyContactPhone || "",
      emergencyRelationship: req.body.emergencyRelationship || "",
      medicalInfo: req.body.medicalInfo || "",
      allergies: req.body.allergies || "",
      bloodGroup: req.body.bloodGroup || "",
      previousSchool: req.body.previousSchool || "",
      transportSubscribed: req.body.transportSubscribed || false,
      transportRoute: req.body.transportRoute || "",
      transportPickupPoint: req.body.transportPickupPoint || "",
      transportDropoffPoint: req.body.transportDropoffPoint || "",
      status: req.body.status || "ACTIVE"
    };
    
    console.log("Creating student with data:", studentData);
    
    const student = new Student(studentData);
    const savedStudent = await student.save();
    
    console.log("Student created successfully:", {
      id: savedStudent._id,
      studentId: savedStudent.studentId,
      name: savedStudent.name
    });
    
    res.status(201).json({
      success: true,
      message: "Student created successfully",
      student: savedStudent
    });
  } catch (error) {
    console.error("Create student error:", error);
    
    // Handle duplicate key error with ONE clean retry using the real
    // prefixed ID generator (Student.getNextStudentId). This used to fall
    // back through several layers of ad-hoc "STD-XXXX" IDs left over from
    // before per-school prefixes existed — those were never actually
    // collision-proof and just papered over the real bug. Now that prefixes
    // are derived from each school's own unique schoolCode (see Student.js),
    // a genuine duplicate here should be extremely rare; this retry exists
    // only to absorb a rare race condition (two requests at the same instant).
    if (error.code === 11000) {
      try {
        console.log("Duplicate key error, retrying with a fresh ID...");
        const retryStudentId = await Student.getNextStudentId(req.user.schoolId);

        const retryData = {
          ...req.body,
          studentId: retryStudentId,
          name: req.body.name.trim(),
          school: req.user.schoolId,
          dateOfBirth: req.body.dateOfBirth || null,
          gender: req.body.gender || "MALE",
          status: req.body.status || "ACTIVE"
        };

        const retryStudent = new Student(retryData);
        const savedStudent = await retryStudent.save();

        console.log("Student created successfully on retry:", {
          id: savedStudent._id,
          studentId: savedStudent.studentId,
          name: savedStudent.name
        });

        return res.status(201).json({
          success: true,
          message: "Student created successfully",
          student: savedStudent
        });
      } catch (retryError) {
        console.error("Retry create student error:", retryError);
        return res.status(400).json({
          success: false,
          message: "Failed to create student after a retry. Please try again."
        });
      }
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        success: false,
        message: "Validation failed", 
        errors: validationErrors
      });
    }
    
    res.status(400).json({ 
      success: false, 
      message: error.message || "Failed to create student"
    });
  }
};

// Update student
exports.updateStudent = async (req, res) => {
  try {
    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.studentId;
    delete updateData.school;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    
    const student = await Student.findOneAndUpdate(
      { _id: req.params.id, school: req.user.schoolId, isDeleted: false },
      updateData,
      { new: true, runValidators: true }
    );
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });
    res.json({
      success: true,
      message: "Student updated successfully",
      student: student
    });
  } catch (error) {
    console.error("Update student error:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// Delete student
exports.deleteStudent = async (req, res) => {
  try {
    const student = await Student.findOneAndUpdate(
      { _id: req.params.id, school: req.user.schoolId },
      { isDeleted: true, deletedAt: new Date(), deletedBy: req.user.id },
      { new: true }
    );
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });
    res.json({ 
      success: true,
      message: "Student deleted successfully" 
    });
  } catch (error) {
    console.error("Delete student error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get student performance
exports.getStudentPerformance = async (req, res) => {
  try {
    const { term, year } = req.query;
    const studentId = req.params.id;
    
    const marks = await Mark.find({
      student: studentId,
      term,
      year: parseInt(year),
      school: req.user.schoolId
    }).populate("course", "courseName courseCode coefficient");
    
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
      studentId,
      marks,
      average,
      totalMarks,
      gradeDistribution,
      subjectsCount: marks.length
    });
  } catch (error) {
    console.error("Get student performance error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get student attendance
exports.getStudentAttendance = async (req, res) => {
  try {
    const { period = "month" } = req.query;
    const studentId = req.params.id;
    
    let startDate = new Date();
    if (period === "week") {
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === "month") {
      startDate.setMonth(startDate.getMonth() - 1);
    } else {
      startDate.setDate(startDate.getDate() - 30);
    }
    
    const attendance = await Attendance.find({
      userId: studentId,
      userType: "STUDENT",
      date: { $gte: startDate },
      school: req.user.schoolId
    });
    
    const total = attendance.length;
    const present = attendance.filter(a => a.status === "PRESENT").length;
    const absent = attendance.filter(a => a.status === "ABSENT").length;
    const late = attendance.filter(a => a.status === "LATE").length;
    
    res.json({
      success: true,
      total,
      present,
      absent,
      late,
      attendanceRate: total > 0 ? ((present + late) / total * 100).toFixed(1) : 0,
      records: attendance
    });
  } catch (error) {
    console.error("Get student attendance error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== BULK IMPORT (EXCEL / CSV) ====================

const isDuplicateKeyError = (err) =>
  !!err && (
    err.code === 11000 ||
    (Array.isArray(err.writeErrors) &&
      err.writeErrors.some((w) => (w.code !== undefined ? w.code : w.err && w.err.code) === 11000))
  );

// Insert students in one batch with freshly reserved IDs. If another request
// grabbed some of the same IDs at the exact same moment (very rare), only the
// rejected students are retried with new IDs, so nobody is saved twice.
async function insertWithFreshIds(schoolId, docs) {
  let pending = docs;
  let inserted = 0;
  let fatalError = null;

  for (let attempt = 0; attempt < 4 && pending.length > 0; attempt++) {
    const ids = await Student.generateBulkStudentIds(schoolId, pending.length);
    pending = pending.map((d, i) => ({ ...d, studentId: ids[i] }));

    try {
      await Student.insertMany(pending, { ordered: false });
      inserted += pending.length;
      pending = [];
    } catch (err) {
      // Find out exactly which of OUR documents were saved before the error.
      const saved = await Student.find({ _id: { $in: pending.map((d) => d._id) } })
        .select("_id")
        .lean();
      const savedIds = new Set(saved.map((d) => String(d._id)));
      inserted += savedIds.size;
      pending = pending.filter((d) => !savedIds.has(String(d._id)));

      if (!isDuplicateKeyError(err)) {
        fatalError = err;
        break;
      }
    }
  }

  return { inserted, failed: pending, fatalError };
}

// Import students from a list of { name, gender } rows into ONE grade + class.
// Body: { grade, className, students: [{ row, name, gender }], dryRun }
// dryRun = true  -> only report what would happen (used for the preview)
// dryRun = false -> actually save the new students
exports.importStudents = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: "School ID not found for this user"
      });
    }

    const body = req.body || {};
    const grade = typeof body.grade === "string" ? body.grade.trim() : "";
    const className = typeof body.className === "string" ? body.className.trim() : "";
    const rows = body.students;
    const dryRun = body.dryRun === true;

    if (!grade || grade.length > 20) {
      return res.status(400).json({ success: false, message: "Grade is required" });
    }
    if (!className || className.length > 20) {
      return res.status(400).json({ success: false, message: "Class name is required" });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No students found in the file"
      });
    }
    if (rows.length > MAX_IMPORT_ROWS) {
      return res.status(400).json({
        success: false,
        message: `Too many rows (${rows.length}). Import at most ${MAX_IMPORT_ROWS} students at a time.`
      });
    }

    // Everything already in this school (only 3 small fields, no deleted ones)
    const existing = await Student.find({ school: schoolId, isDeleted: false })
      .select("name grade className gender")
      .lean();

    const { items, toAdd } = analyzeRows(rows, existing, grade, className);
    const summary = summarize(items);

    if (dryRun) {
      return res.json({ success: true, dryRun: true, grade, className, summary, rows: items });
    }

    if (toAdd.length === 0) {
      return res.json({
        success: true,
        dryRun: false,
        grade,
        className,
        added: 0,
        summary,
        rows: items,
        message: "No new students to add"
      });
    }

    const schoolObjectId = new mongoose.Types.ObjectId(String(schoolId));
    const docs = toAdd.map((s) => ({
      _id: new mongoose.Types.ObjectId(),
      name: s.name,
      gender: s.gender,
      grade,
      className,
      school: schoolObjectId,
      status: "ACTIVE",
      isDeleted: false
    }));

    const { inserted, failed, fatalError } = await insertWithFreshIds(schoolId, docs);

    if (fatalError) {
      console.error("Import students error:", fatalError);
      return res.status(500).json({
        success: false,
        message:
          inserted > 0
            ? `Import stopped by a server error. ${inserted} student(s) were saved before it happened — re-upload the same file to add the rest (existing names are skipped automatically).`
            : "Import failed because of a server error. Nothing was saved. Please try again.",
        added: inserted
      });
    }

    if (failed.length > 0) {
      return res.status(409).json({
        success: false,
        message: `${inserted} student(s) were saved, but ${failed.length} could not be saved because the system was busy. Re-upload the same file to add the rest (existing names are skipped automatically).`,
        added: inserted
      });
    }

    console.log(`Import students: ${inserted} added to ${grade} ${className} (school ${schoolId})`);

    res.status(201).json({
      success: true,
      dryRun: false,
      grade,
      className,
      added: inserted,
      summary,
      rows: items,
      message: `${inserted} student(s) added to ${grade} ${className}`
    });
  } catch (error) {
    console.error("Import students error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to import students"
    });
  }
};