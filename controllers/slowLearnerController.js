const SlowLearner = require("../models/SlowLearner");
const Student = require("../models/Student");

exports.createCase = async (req, res) => {
  try {
    const { studentId, problemDescription, problemCategory, measuresTaken, semester } = req.body;
    
    const student = await Student.findOne({ _id: studentId, school: req.user.schoolId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    
    // Check if case already exists for this semester
    const existing = await SlowLearner.findOne({
      student: studentId,
      semester,
      academicYear: new Date().getFullYear(),
      school: req.user.schoolId
    });
    
    if (existing) {
      return res.status(400).json({ message: "A case already exists for this student this semester" });
    }
    
    const slowLearner = new SlowLearner({
      student: studentId,
      studentName: student.name,
      studentId: student.studentId,
      grade: student.grade,
      className: student.className,
      problemDescription,
      problemCategory,
      measuresTaken: [measuresTaken],
      recordedBy: req.user.id,
      recordedByName: req.user.name,
      semester,
      academicYear: new Date().getFullYear(),
      school: req.user.schoolId
    });
    
    await slowLearner.save();
    
    res.status(201).json({
      success: true,
      message: "Slow learner case created",
      case: slowLearner
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllCases = async (req, res) => {
  try {
    const { status, grade, className, semester } = req.query;
    let filter = { school: req.user.schoolId };
    
    if (status) filter.status = status;
    if (grade) filter.grade = grade;
    if (className) filter.className = className;
    if (semester) filter.semester = semester;
    
    const cases = await SlowLearner.find(filter)
      .populate("student", "name studentId")
      .sort({ createdAt: -1 });
    
    const summary = {
      total: cases.length,
      identified: cases.filter(c => c.status === "IDENTIFIED").length,
      inProgress: cases.filter(c => c.status === "IN_PROGRESS").length,
      improving: cases.filter(c => c.status === "IMPROVING").length,
      resolved: cases.filter(c => c.status === "RESOLVED").length,
      byCategory: {
        READING: cases.filter(c => c.problemCategory === "READING").length,
        WRITING: cases.filter(c => c.problemCategory === "WRITING").length,
        MATHEMATICS: cases.filter(c => c.problemCategory === "MATHEMATICS").length,
        ATTENTION: cases.filter(c => c.problemCategory === "ATTENTION").length,
        MEMORY: cases.filter(c => c.problemCategory === "MEMORY").length,
        OTHER: cases.filter(c => c.problemCategory === "OTHER").length
      }
    };
    
    res.json({ cases, summary });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getCasesByClass = async (req, res) => {
  try {
    const { grade, className } = req.query;
    
    let filter = { school: req.user.schoolId };
    if (grade) filter.grade = grade;
    if (className) filter.className = className;
    
    const cases = await SlowLearner.find(filter)
      .populate("student", "name studentId")
      .sort({ createdAt: -1 });
    
    // Group by class
    const byClass = {};
    cases.forEach(c => {
      const key = `${c.grade} - ${c.className}`;
      if (!byClass[key]) {
        byClass[key] = { total: 0, resolved: 0, inProgress: 0, students: [] };
      }
      byClass[key].total++;
      byClass[key][c.status.toLowerCase()]++;
      byClass[key].students.push({
        name: c.studentName,
        problem: c.problemDescription,
        status: c.status,
        measures: c.measuresTaken
      });
    });
    
    res.json({ byClass, totalCases: cases.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.addProgressNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { note, improvementLevel } = req.body;
    
    const slowLearner = await SlowLearner.findOne({ _id: id, school: req.user.schoolId });
    if (!slowLearner) {
      return res.status(404).json({ message: "Case not found" });
    }
    
    slowLearner.progressNotes.push({
      note,
      recordedBy: req.user.id,
      recordedByName: req.user.name,
      improvementLevel
    });
    
    // Auto-update status based on improvement
    if (improvementLevel && improvementLevel >= 70) {
      slowLearner.status = "IMPROVING";
      if (improvementLevel >= 90) slowLearner.status = "RESOLVED";
    } else if (slowLearner.status === "IDENTIFIED") {
      slowLearner.status = "IN_PROGRESS";
    }
    
    await slowLearner.save();
    
    res.json({
      success: true,
      message: "Progress note added",
      case: slowLearner
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const slowLearner = await SlowLearner.findOne({ _id: id, school: req.user.schoolId });
    if (!slowLearner) {
      return res.status(404).json({ message: "Case not found" });
    }
    
    slowLearner.status = status;
    await slowLearner.save();
    
    res.json({ success: true, message: "Status updated", case: slowLearner });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getReport = async (req, res) => {
  try {
    const { semester, academicYear, grade, className } = req.query;
    
    let filter = { school: req.user.schoolId };
    if (semester) filter.semester = semester;
    if (academicYear) filter.academicYear = parseInt(academicYear);
    if (grade) filter.grade = grade;
    if (className) filter.className = className;
    
    const cases = await SlowLearner.find(filter).sort({ createdAt: -1 });
    
    const summary = {
      totalCases: cases.length,
      resolvedCount: cases.filter(c => c.status === "RESOLVED").length,
      resolutionRate: cases.length > 0 
        ? ((cases.filter(c => c.status === "RESOLVED").length / cases.length) * 100).toFixed(1)
        : 0,
      averageImprovement: cases.reduce((sum, c) => {
        const lastProgress = c.progressNotes[c.progressNotes.length - 1];
        return sum + (lastProgress?.improvementLevel || 0);
      }, 0) / (cases.length || 1)
    };
    
    res.json({ summary, cases });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};