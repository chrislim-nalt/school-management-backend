const Teacher = require("../models/Teacher");
const Student = require("../models/Student");
const TransportPayment = require("../models/TransportPayment");
const TransportRecord = require("../models/TransportRecord");

// ==================== TEACHER MANAGEMENT ====================

// Get all teachers - FIXED: Always return array
exports.getTeachers = async (req, res) => {
  try {
    const { status } = req.query;
    let filter = { school: req.user.schoolId };
    
    if (status) filter.status = status;
    
    const teachers = await Teacher.find(filter)
      .populate("subjects", "courseName courseCode")
      .sort({ name: 1 });
    
    // Always return an array, even if empty
    res.json({
      success: true,
      teachers: teachers || [],
      count: (teachers || []).length
    });
  } catch (error) {
    console.error("Get teachers error:", error);
    // Return empty array on error
    res.status(500).json({ 
      success: false, 
      message: error.message,
      teachers: [],
      count: 0
    });
  }
};

// Get single teacher
exports.getTeacherById = async (req, res) => {
  try {
    const teacher = await Teacher.findOne({
      _id: req.params.id,
      school: req.user.schoolId
    }).populate("subjects", "courseName courseCode");
    
    if (!teacher) {
      return res.status(404).json({ success: false, message: "Teacher not found" });
    }
    
    res.json({
      success: true,
      teacher
    });
  } catch (error) {
    console.error("Get teacher error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create teacher
exports.createTeacher = async (req, res) => {
  try {
    const { name, email, phone, address, subjects, hireDate, qualification, specialization, status } = req.body;
    
    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({ 
        success: false, 
        message: "Name and email are required" 
      });
    }
    
    // Check if teacher already exists
    const existingTeacher = await Teacher.findOne({ 
      email: email.toLowerCase(), 
      school: req.user.schoolId 
    });
    if (existingTeacher) {
      return res.status(400).json({ 
        success: false, 
        message: "Teacher with this email already exists in this school" 
      });
    }
    
    const teacherId = await Teacher.generateTeacherId(req.user.schoolId);
    
    const teacher = new Teacher({
      teacherId,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone || "",
      address: address || "",
      subjects: subjects || [],
      hireDate: hireDate || new Date(),
      qualification: qualification || "",
      specialization: specialization || "",
      status: status || "ACTIVE",
      permissions: {
        canAddMarks: true,
        canManageAttendance: true,
        canViewReports: true
      },
      school: req.user.schoolId
    });
    
    await teacher.save();
    
    res.status(201).json({
      success: true,
      message: "Teacher created successfully",
      teacher
    });
  } catch (error) {
    console.error("Create teacher error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update teacher
exports.updateTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.teacherId;
    delete updateData.school;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    
    // If email is being updated, check for duplicates
    if (updateData.email) {
      updateData.email = updateData.email.toLowerCase().trim();
      const existing = await Teacher.findOne({
        email: updateData.email,
        school: req.user.schoolId,
        _id: { $ne: id }
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: "Email already in use by another teacher"
        });
      }
    }
    
    const teacher = await Teacher.findOneAndUpdate(
      { _id: id, school: req.user.schoolId },
      updateData,
      { new: true, runValidators: true }
    ).populate("subjects", "courseName courseCode");
    
    if (!teacher) {
      return res.status(404).json({ success: false, message: "Teacher not found" });
    }
    
    res.json({
      success: true,
      message: "Teacher updated successfully",
      teacher
    });
  } catch (error) {
    console.error("Update teacher error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete teacher
exports.deleteTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    
    const teacher = await Teacher.findOneAndDelete({
      _id: id,
      school: req.user.schoolId
    });
    
    if (!teacher) {
      return res.status(404).json({ success: false, message: "Teacher not found" });
    }
    
    res.json({
      success: true,
      message: "Teacher deleted successfully"
    });
  } catch (error) {
    console.error("Delete teacher error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get teacher attendance stats
exports.getTeacherAttendanceStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const schoolId = req.user.schoolId;
    
    const filter = { school: schoolId };
    if (startDate && endDate) {
      filter.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    
    const teachers = await Teacher.find(filter);
    
    const activeTeachers = teachers.filter(t => t.status === "ACTIVE").length;
    const onLeave = teachers.filter(t => t.status === "ON_LEAVE").length;
    const inactive = teachers.filter(t => t.status === "INACTIVE").length;
    
    res.json({
      success: true,
      summary: {
        total: teachers.length,
        active: activeTeachers,
        onLeave,
        inactive
      },
      teachers: teachers.map(t => ({
        id: t._id,
        name: t.name,
        email: t.email,
        status: t.status,
        subjects: t.subjects
      }))
    });
  } catch (error) {
    console.error("Get teacher attendance stats error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== STUDENT FILTERING ====================

// Get students by class for transport
exports.getStudentsByClass = async (req, res) => {
  try {
    const { grade, className } = req.query;
    
    if (!grade || !className) {
      return res.status(400).json({ 
        success: false, 
        message: "Grade and class are required" 
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
    }).select("name studentId grade className transportSubscribed transportRoute");
    
    res.json({
      success: true,
      students: students || [],
      count: (students || []).length
    });
  } catch (error) {
    console.error("Get students by class error:", error);
    res.status(500).json({ success: false, message: error.message, students: [] });
  }
};

// Get all classes for the school
exports.getSchoolClasses = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: "School ID not found for this user"
      });
    }

    const classes = await Student.aggregate([
      { 
        $match: { 
          school: schoolId, 
          status: "ACTIVE",
          isDeleted: false 
        } 
      },
      {
        $group: {
          _id: {
            grade: "$grade",
            className: "$className"
          },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          grade: "$_id.grade",
          className: "$_id.className",
          studentCount: "$count"
        }
      },
      { $sort: { grade: 1, className: 1 } }
    ]);
    
    res.json({
      success: true,
      classes: classes || []
    });
  } catch (error) {
    console.error("Get school classes error:", error);
    res.status(500).json({ success: false, message: error.message, classes: [] });
  }
};

// ==================== TRANSPORT PAYMENTS ====================

// Get transport payments with filters
exports.getTransportPayments = async (req, res) => {
  try {
    const { semester, year, grade, className, status } = req.query;
    const schoolId = req.user.schoolId;
    
    let filter = { school: schoolId };
    
    if (semester) filter.semester = semester;
    if (year) filter.year = parseInt(year);
    if (status) filter.status = status;
    if (grade) filter.grade = grade;
    if (className) filter.className = className;
    
    const payments = await TransportPayment.find(filter)
      .populate('student', 'name studentId grade className')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: (payments || []).length,
      payments: payments || []
    });
  } catch (error) {
    console.error("Get transport payments error:", error);
    res.status(500).json({ success: false, message: error.message, payments: [] });
  }
};

// Create transport payment
exports.createTransportPayment = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    
    const { studentId, semester, year, amount, amountPaid, paymentMethod, reference, notes } = req.body;
    
    if (!studentId || !semester || !year || !amount) {
      return res.status(400).json({ 
        success: false, 
        message: "Student ID, semester, year, and amount are required" 
      });
    }
    
    const student = await Student.findOne({ _id: studentId, school: schoolId });
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }
    
    const existingPayment = await TransportPayment.findOne({
      student: studentId,
      semester,
      year: parseInt(year),
      school: schoolId
    });
    
    if (existingPayment) {
      return res.status(400).json({ 
        success: false, 
        message: `Payment record already exists for ${student.name} for ${semester} ${year}` 
      });
    }
    
    const finalAmountPaid = amountPaid ? parseFloat(amountPaid) : 0;
    const finalAmount = parseFloat(amount);
    
    const payment = new TransportPayment({
      student: studentId,
      studentName: student.name,
      studentId: student.studentId,
      grade: student.grade,
      className: student.className,
      semester,
      year: parseInt(year),
      amount: finalAmount,
      amountPaid: finalAmountPaid,
      paymentMethod: paymentMethod || "CASH",
      reference: reference || "",
      notes: notes || "",
      paymentDate: finalAmountPaid > 0 ? new Date() : null,
      recordedBy: req.user.id,
      recordedByName: req.user.name || req.user.email || "Unknown",
      school: schoolId
    });
    
    await payment.save();
    
    if (payment.status === "PAID") {
      student.transportSubscribed = true;
      await student.save();
    }
    
    res.status(201).json({
      success: true,
      message: "Transport payment recorded successfully",
      payment
    });
  } catch (error) {
    console.error("Create transport payment error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update transport payment
exports.updateTransportPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amountPaid, paymentMethod, reference, notes } = req.body;
    const schoolId = req.user.schoolId;
    
    const payment = await TransportPayment.findOne({ _id: id, school: schoolId });
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }
    
    if (amountPaid !== undefined) {
      payment.amountPaid = parseFloat(amountPaid);
    }
    if (paymentMethod) payment.paymentMethod = paymentMethod;
    if (reference !== undefined) payment.reference = reference;
    if (notes !== undefined) payment.notes = notes;
    
    if (amountPaid > 0 && !payment.paymentDate) {
      payment.paymentDate = new Date();
    }
    
    await payment.save();
    
    res.json({
      success: true,
      message: "Payment updated successfully",
      payment
    });
  } catch (error) {
    console.error("Update transport payment error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete transport payment
exports.deleteTransportPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;
    
    const payment = await TransportPayment.findOneAndDelete({ _id: id, school: schoolId });
    
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }
    
    res.json({
      success: true,
      message: "Payment deleted successfully"
    });
  } catch (error) {
    console.error("Delete transport payment error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== TRANSPORT RECORDS ====================

// Get transport records
exports.getTransportRecords = async (req, res) => {
  try {
    const { startDate, endDate, grade, className, student } = req.query;
    const schoolId = req.user.schoolId;
    
    let filter = { school: schoolId };
    
    if (startDate && endDate) {
      filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    if (grade) filter.grade = grade;
    if (className) filter.className = className;
    if (student) filter.student = student;
    
    const records = await TransportRecord.find(filter)
      .populate('student', 'name studentId grade className')
      .sort({ date: -1 });
    
    res.json({
      success: true,
      count: (records || []).length,
      records: records || []
    });
  } catch (error) {
    console.error("Get transport records error:", error);
    res.status(500).json({ success: false, message: error.message, records: [] });
  }
};

// Create transport record
exports.createTransportRecord = async (req, res) => {
  try {
    const { studentId, date, pickupLocation, dropoffLocation, distance, status, notes } = req.body;
    const schoolId = req.user.schoolId;
    
    if (!studentId) {
      return res.status(400).json({ success: false, message: "Student ID is required" });
    }
    
    const student = await Student.findOne({ _id: studentId, school: schoolId });
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }
    
    const record = new TransportRecord({
      student: studentId,
      studentName: student.name,
      studentId: student.studentId,
      grade: student.grade,
      className: student.className,
      date: date || new Date(),
      pickupLocation: pickupLocation || "",
      dropoffLocation: dropoffLocation || "",
      distance: distance ? parseFloat(distance) : 0,
      status: status || "COMPLETED",
      notes: notes || "",
      recordedBy: req.user.id,
      recordedByName: req.user.name || req.user.email || "Unknown",
      school: schoolId
    });
    
    await record.save();
    
    res.status(201).json({
      success: true,
      message: "Transport record added successfully",
      record
    });
  } catch (error) {
    console.error("Create transport record error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete transport record
exports.deleteTransportRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;
    
    const record = await TransportRecord.findOneAndDelete({ _id: id, school: schoolId });
    
    if (!record) {
      return res.status(404).json({ success: false, message: "Record not found" });
    }
    
    res.json({
      success: true,
      message: "Record deleted successfully"
    });
  } catch (error) {
    console.error("Delete transport record error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== FINANCIAL REPORTS ====================

// Get transport financial summary
exports.getTransportFinancialSummary = async (req, res) => {
  try {
    const { year, semester } = req.query;
    const schoolId = req.user.schoolId;
    
    let filter = { school: schoolId };
    
    if (year) filter.year = parseInt(year);
    if (semester) filter.semester = semester;
    
    const payments = await TransportPayment.find(filter);
    
    const totalExpected = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalPaid = payments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
    const totalBalance = payments.reduce((sum, p) => sum + (p.balance || 0), 0);
    
    const paidStudents = payments.filter(p => p.status === "PAID").length;
    const partialStudents = payments.filter(p => p.status === "PARTIAL").length;
    const unpaidStudents = payments.filter(p => p.status === "UNPAID").length;
    
    const byClass = {};
    payments.forEach(p => {
      const className = `${p.grade} ${p.className}`;
      if (!byClass[className]) {
        byClass[className] = { total: 0, paid: 0, balance: 0, students: 0 };
      }
      byClass[className].total += p.amount;
      byClass[className].paid += p.amountPaid;
      byClass[className].balance += p.balance;
      byClass[className].students++;
    });
    
    res.json({
      success: true,
      summary: {
        totalExpected,
        totalPaid,
        totalBalance,
        collectionRate: totalExpected > 0 ? ((totalPaid / totalExpected) * 100).toFixed(1) : 0,
        studentsSummary: {
          paid: paidStudents,
          partial: partialStudents,
          unpaid: unpaidStudents,
          total: payments.length
        }
      },
      byClass
    });
  } catch (error) {
    console.error("Get transport financial summary error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get term payments report
exports.getTermPaymentsReport = async (req, res) => {
  try {
    const { term, year, grade, className } = req.query;
    const schoolId = req.user.schoolId;
    
    let filter = { 
      school: schoolId,
      semester: term,
      year: parseInt(year)
    };
    if (grade && grade !== "ALL") filter.grade = grade;
    if (className && className !== "ALL") filter.className = className;
    
    const payments = await TransportPayment.find(filter);
    
    const summary = {
      term,
      year,
      totalStudents: payments.length,
      totalAmount: payments.reduce((sum, p) => sum + (p.amount || 0), 0),
      totalPaid: payments.reduce((sum, p) => sum + (p.amountPaid || 0), 0),
      totalBalance: payments.reduce((sum, p) => sum + (p.balance || 0), 0),
      collectionRate: payments.reduce((sum, p) => sum + (p.amount || 0), 0) > 0
        ? ((payments.reduce((sum, p) => sum + (p.amountPaid || 0), 0) / payments.reduce((sum, p) => sum + (p.amount || 0), 0)) * 100).toFixed(1)
        : 0,
      statusBreakdown: {
        paid: payments.filter(p => p.status === "PAID").length,
        partial: payments.filter(p => p.status === "PARTIAL").length,
        unpaid: payments.filter(p => p.status === "UNPAID").length
      }
    };
    
    res.json({ success: true, summary, payments });
  } catch (error) {
    console.error("Get term payments report error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get outstanding payments
exports.getOutstandingPayments = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    
    const payments = await TransportPayment.find({
      status: { $in: ["PARTIAL", "UNPAID"] },
      school: schoolId
    }).populate('student', 'name studentId grade className');
    
    const totalOutstanding = payments.reduce((sum, p) => sum + (p.balance || 0), 0);
    
    res.json({
      success: true,
      totalOutstanding,
      outstandingCount: payments.length,
      payments
    });
  } catch (error) {
    console.error("Get outstanding payments error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get student's transport history
exports.getStudentTransportHistory = async (req, res) => {
  try {
    const { studentId } = req.params;
    const schoolId = req.user.schoolId;
    
    const student = await Student.findOne({ _id: studentId, school: schoolId });
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }
    
    const payments = await TransportPayment.find({ 
      student: studentId, 
      school: schoolId 
    }).sort({ year: -1, semester: -1 });
    
    const records = await TransportRecord.find({ 
      student: studentId, 
      school: schoolId 
    }).sort({ date: -1 }).limit(30);
    
    res.json({
      success: true,
      student: {
        name: student.name,
        studentId: student.studentId,
        grade: student.grade,
        className: student.className,
        transportSubscribed: student.transportSubscribed
      },
      payments,
      records
    });
  } catch (error) {
    console.error("Get student transport history error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};