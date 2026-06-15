const TransportPayment = require("../models/TransportPayment");
const TransportRecord = require("../models/TransportRecord");
const Student = require("../models/Student");

// Helper function to check permissions
const hasPermission = (user, allowedTypes) => {
  if (user.role === "superadmin") return true;
  return allowedTypes.includes(user.userType);
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
    
    const students = await Student.find({
      grade,
      className,
      school: req.user.schoolId,
      status: "ACTIVE",
      isDeleted: false
    }).select("name studentId grade className transportSubscribed transportRoute");
    
    res.json({
      success: true,
      students,
      count: students.length
    });
  } catch (error) {
    console.error("Get students by class error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== TRANSPORT PAYMENTS ====================

// Get transport payments with filters
exports.getTransportPayments = async (req, res) => {
  try {
    if (!hasPermission(req.user, ["bursar", "school_admin"])) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Only bursar and administrators can view transport payments." 
      });
    }

    const { semester, year, grade, className, status } = req.query;
    let filter = { school: req.user.schoolId };
    
    if (semester) filter.semester = semester;
    if (year) filter.year = parseInt(year);
    if (status) filter.status = status;
    if (grade) filter.grade = grade;
    if (className) filter.className = className;
    
    const payments = await TransportPayment.find(filter)
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: payments.length,
      payments
    });
  } catch (error) {
    console.error("Get transport payments error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create transport payment
exports.createTransportPayment = async (req, res) => {
  try {
    console.log("=== CREATE TRANSPORT PAYMENT ===");
    console.log("Request body:", req.body);
    console.log("User:", req.user);
    
    // Permission check
    if (!hasPermission(req.user, ["bursar", "school_admin"])) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Only bursar and administrators can create transport payments." 
      });
    }

    const { studentId, semester, year, amount, amountPaid, paymentMethod, reference, notes } = req.body;
    
    // Validation
    if (!studentId) {
      return res.status(400).json({ success: false, message: "Student ID is required" });
    }
    if (!semester) {
      return res.status(400).json({ success: false, message: "Semester is required" });
    }
    if (!year) {
      return res.status(400).json({ success: false, message: "Year is required" });
    }
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Valid amount is required" });
    }
    
    // Find student
    const student = await Student.findOne({ _id: studentId, school: req.user.schoolId });
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }
    
    console.log("Found student:", student.name, student.studentId);
    
    // Check if payment already exists for this student/term/year
    const existingPayment = await TransportPayment.findOne({
      student: studentId,
      semester,
      year: parseInt(year),
      school: req.user.schoolId
    });
    
    if (existingPayment) {
      return res.status(400).json({ 
        success: false, 
        message: `Payment record already exists for ${student.name} for ${semester} ${year}. Use update instead.` 
      });
    }
    
    // Calculate amount paid and balance
    const finalAmountPaid = amountPaid ? parseFloat(amountPaid) : 0;
    const finalAmount = parseFloat(amount);
    
    const paymentData = {
      student: studentId,
      studentName: student.name,
      studentId: student.studentId,
      grade: student.grade,
      className: student.className,
      semester: semester,
      year: parseInt(year),
      amount: finalAmount,
      amountPaid: finalAmountPaid,
      paymentMethod: paymentMethod || "CASH",
      reference: reference || "",
      notes: notes || "",
      paymentDate: finalAmountPaid > 0 ? new Date() : null,
      recordedBy: req.user.id,
      recordedByName: req.user.name,
      school: req.user.schoolId
    };
    
    console.log("Creating payment with data:", paymentData);
    
    const payment = new TransportPayment(paymentData);
    await payment.save();
    
    console.log("Payment saved successfully:", payment._id);
    
    // Update student transport subscription
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
    if (!hasPermission(req.user, ["bursar", "school_admin"])) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied." 
      });
    }

    const { id } = req.params;
    const { amountPaid, paymentMethod, reference, notes } = req.body;
    
    const payment = await TransportPayment.findOne({ _id: id, school: req.user.schoolId });
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }
    
    payment.amountPaid = amountPaid !== undefined ? parseFloat(amountPaid) : payment.amountPaid;
    payment.paymentMethod = paymentMethod || payment.paymentMethod;
    payment.reference = reference || payment.reference;
    payment.notes = notes || payment.notes;
    
    if (amountPaid > 0 && !payment.paymentDate) {
      payment.paymentDate = new Date();
    }
    
    await payment.save();
    
    // Update student transport subscription
    const student = await Student.findById(payment.student);
    if (student && payment.status === "PAID") {
      student.transportSubscribed = true;
      await student.save();
    }
    
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
    if (!hasPermission(req.user, ["bursar", "school_admin"])) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied." 
      });
    }

    const { id } = req.params;
    const payment = await TransportPayment.findOneAndDelete({ _id: id, school: req.user.schoolId });
    
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
    if (!hasPermission(req.user, ["bursar", "school_admin"])) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied." 
      });
    }

    const { startDate, endDate, grade, className, student } = req.query;
    let filter = { school: req.user.schoolId };
    
    if (startDate && endDate) {
      filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    if (grade) filter.grade = grade;
    if (className) filter.className = className;
    if (student) filter.student = student;
    
    const records = await TransportRecord.find(filter)
      .sort({ date: -1 });
    
    res.json({
      success: true,
      count: records.length,
      records
    });
  } catch (error) {
    console.error("Get transport records error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create transport record
exports.createTransportRecord = async (req, res) => {
  try {
    if (!hasPermission(req.user, ["bursar", "school_admin"])) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Only bursar and administrators can record transport trips." 
      });
    }

    const { studentId, date, pickupLocation, dropoffLocation, distance, status, notes } = req.body;
    
    if (!studentId) {
      return res.status(400).json({ success: false, message: "Student ID is required" });
    }
    
    const student = await Student.findOne({ _id: studentId, school: req.user.schoolId });
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }
    
    // Check for duplicate record on same day
    const recordDate = new Date(date);
    recordDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(recordDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    const existingRecord = await TransportRecord.findOne({
      student: studentId,
      date: { $gte: recordDate, $lt: nextDay },
      school: req.user.schoolId
    });
    
    if (existingRecord) {
      return res.status(400).json({ 
        success: false, 
        message: "A record already exists for this student on this date" 
      });
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
      recordedByName: req.user.name,
      school: req.user.schoolId
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
    if (!hasPermission(req.user, ["bursar", "school_admin"])) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied." 
      });
    }

    const { id } = req.params;
    const record = await TransportRecord.findOneAndDelete({ _id: id, school: req.user.schoolId });
    
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
    if (!hasPermission(req.user, ["bursar", "school_admin"])) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied." 
      });
    }

    const { year, semester } = req.query;
    let filter = { school: req.user.schoolId };
    
    if (year) filter.year = parseInt(year);
    if (semester) filter.semester = semester;
    
    const payments = await TransportPayment.find(filter);
    
    const totalExpected = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalPaid = payments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
    const totalBalance = payments.reduce((sum, p) => sum + (p.balance || 0), 0);
    
    const paidStudents = payments.filter(p => p.status === "PAID").length;
    const partialStudents = payments.filter(p => p.status === "PARTIAL").length;
    const unpaidStudents = payments.filter(p => p.status === "UNPAID").length;
    
    // By class breakdown
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
    if (!hasPermission(req.user, ["bursar", "school_admin"])) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied." 
      });
    }

    const { term, year, grade, className } = req.query;
    
    let filter = { 
      school: req.user.schoolId,
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
    if (!hasPermission(req.user, ["bursar", "school_admin"])) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied." 
      });
    }

    const payments = await TransportPayment.find({
      status: { $in: ["PARTIAL", "UNPAID"] },
      school: req.user.schoolId
    });
    
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