// controllers/feeController.js
const SchoolFee = require("../models/SchoolFee");
const Student = require("../models/Student");

// ==================== RECORD OR UPDATE FEE ====================
exports.recordFee = async (req, res) => {
  try {
    const { 
      studentId, 
      totalFees, 
      amountPaid, 
      term, 
      academicYear, 
      paymentMethod, 
      reference, 
      notes 
    } = req.body;
    
    // Validate required fields
    if (!studentId || !term) {
      return res.status(400).json({ 
        success: false, 
        message: "Student ID and term are required" 
      });
    }
    
    // Find student
    const student = await Student.findOne({ 
      _id: studentId, 
      school: req.user.schoolId 
    });
    
    if (!student) {
      return res.status(404).json({ 
        success: false, 
        message: "Student not found" 
      });
    }
    
    const year = academicYear || new Date().getFullYear();
    const paidAmount = parseFloat(amountPaid) || 0;
    const total = parseFloat(totalFees) || 0;
    
    // Find or create fee record
    let feeRecord = await SchoolFee.findOne({
      student: studentId,
      term: term,
      academicYear: year,
      school: req.user.schoolId
    });
    
    if (feeRecord) {
      // Update existing record
      if (total > 0) feeRecord.totalFees = total;
      feeRecord.amountPaid += paidAmount;
      feeRecord.balance = feeRecord.totalFees - feeRecord.amountPaid;
      
      // Add payment record
      if (paidAmount > 0) {
        feeRecord.payments.push({
          amount: paidAmount,
          paymentMethod: paymentMethod || "CASH",
          reference: reference || "",
          recordedBy: req.user.id,
          recordedByName: req.user.name || "Unknown",
          notes: notes || ""
        });
      }
      
      // Update status
      if (feeRecord.balance <= 0) {
        feeRecord.status = "PAID";
      } else if (feeRecord.amountPaid > 0) {
        feeRecord.status = "PARTIAL";
      } else {
        feeRecord.status = "UNPAID";
      }
    } else {
      // Create new record
      feeRecord = new SchoolFee({
        student: studentId,
        studentName: student.name,
        studentId: student.studentId,
        grade: student.grade,
        className: student.className,
        totalFees: total,
        amountPaid: paidAmount,
        balance: total - paidAmount,
        term: term,
        academicYear: year,
        school: req.user.schoolId,
        status: total > 0 && paidAmount >= total ? "PAID" : (paidAmount > 0 ? "PARTIAL" : "UNPAID")
      });
      
      if (paidAmount > 0) {
        feeRecord.payments.push({
          amount: paidAmount,
          paymentMethod: paymentMethod || "CASH",
          reference: reference || "",
          recordedBy: req.user.id,
          recordedByName: req.user.name || "Unknown",
          notes: notes || ""
        });
      }
    }
    
    await feeRecord.save();
    
    res.json({
      success: true,
      message: "Fee record saved successfully",
      feeRecord
    });
  } catch (error) {
    console.error("Record fee error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ==================== GET FEE RECORDS ====================
exports.getFeeRecords = async (req, res) => {
  try {
    const { status, grade, className, term, academicYear, search } = req.query;
    
    let filter = { school: req.user.schoolId };
    if (status) filter.status = status;
    if (grade) filter.grade = grade;
    if (className) filter.className = className;
    if (term) filter.term = term;
    if (academicYear) filter.academicYear = parseInt(academicYear);
    if (search) {
      filter.$or = [
        { studentName: { $regex: search, $options: "i" } },
        { studentId: { $regex: search, $options: "i" } }
      ];
    }
    
    const records = await SchoolFee.find(filter)
      .populate("student", "name studentId")
      .sort({ balance: -1 });
    
    // Summary statistics.
    // totalBalance/totalCredit are split so reports mean something:
    // - totalBalance = money still OWED TO the school (sum of positive balances only)
    // - totalCredit  = money the school OWES BACK to students (sum of overpayments)
    // Mixing the two into one raw sum would understate what's actually outstanding.
    const summary = {
      totalStudents: records.length,
      totalFees: records.reduce((sum, r) => sum + r.totalFees, 0),
      totalPaid: records.reduce((sum, r) => sum + r.amountPaid, 0),
      totalBalance: records.reduce((sum, r) => sum + (r.balance > 0 ? r.balance : 0), 0),
      totalCredit: records.reduce((sum, r) => sum + (r.balance < 0 ? Math.abs(r.balance) : 0), 0),
      paid: records.filter(r => r.status === "PAID" && r.balance === 0).length,
      overpaid: records.filter(r => r.balance < 0).length,
      partial: records.filter(r => r.status === "PARTIAL").length,
      unpaid: records.filter(r => r.status === "UNPAID").length,
      overdue: records.filter(r => r.status === "OVERDUE").length
    };
    
    res.json({
      success: true,
      records,
      summary
    });
  } catch (error) {
    console.error("Get fee records error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ==================== GET OUTSTANDING FEES (DEBTORS) ====================
exports.getOutstandingFees = async (req, res) => {
  try {
    const { grade, className, term, academicYear } = req.query;
    
    let filter = { 
      school: req.user.schoolId,
      balance: { $gt: 0 },
      status: { $in: ["UNPAID", "PARTIAL", "OVERDUE"] }
    };
    
    if (grade) filter.grade = grade;
    if (className) filter.className = className;
    if (term) filter.term = term;
    if (academicYear) filter.academicYear = parseInt(academicYear);
    
    const records = await SchoolFee.find(filter)
      .populate("student", "name studentId")
      .sort({ balance: -1 });
    
    const totalOutstanding = records.reduce((sum, r) => sum + r.balance, 0);
    
    res.json({
      success: true,
      records,
      totalOutstanding,
      count: records.length
    });
  } catch (error) {
    console.error("Get outstanding fees error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ==================== GET STUDENT FEE SUMMARY ====================
exports.getStudentFeeSummary = async (req, res) => {
  try {
    const { studentId } = req.params;
    
    const records = await SchoolFee.find({
      student: studentId,
      school: req.user.schoolId
    }).sort({ academicYear: -1, term: -1 });
    
    const totalFees = records.reduce((sum, r) => sum + r.totalFees, 0);
    const totalPaid = records.reduce((sum, r) => sum + r.amountPaid, 0);
    const totalBalance = records.reduce((sum, r) => sum + r.balance, 0);

    const summary = {
      totalFees,
      totalPaid,
      totalBalance,
      // A negative totalBalance means the student/parent has paid more than
      // owed overall — that surplus is money the school owes back to them.
      creditBalance: totalBalance < 0 ? Math.abs(totalBalance) : 0,
      currentBalance: records.length > 0 ? records[0].balance : 0,
      status: records.length > 0 ? records[0].status : "NO_RECORD",
      records
    };
    
    res.json({
      success: true,
      summary
    });
  } catch (error) {
    console.error("Get student fee summary error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ==================== UPDATE FEE RECORD ====================
// Lets an admin/bursar correct a record directly (e.g. fix a typo in
// totalFees, term, academic year, or notes) rather than only ever adding
// more payments. Recalculates balance/status the same way recordFee does,
// so overpayments are always reflected correctly (balance can go negative,
// meaning the school owes the student/parent a refund/credit).
exports.updateFee = async (req, res) => {
  try {
    const { id } = req.params;
    const { totalFees, amountPaid, term, academicYear, notes } = req.body;

    const feeRecord = await SchoolFee.findOne({
      _id: id,
      school: req.user.schoolId
    });

    if (!feeRecord) {
      return res.status(404).json({
        success: false,
        message: "Fee record not found"
      });
    }

    if (totalFees !== undefined && totalFees !== null && totalFees !== "") {
      feeRecord.totalFees = parseFloat(totalFees) || 0;
    }
    if (amountPaid !== undefined && amountPaid !== null && amountPaid !== "") {
      feeRecord.amountPaid = parseFloat(amountPaid) || 0;
    }
    if (term) feeRecord.term = term;
    if (academicYear) feeRecord.academicYear = parseInt(academicYear);
    if (notes !== undefined) feeRecord.notes = notes;

    feeRecord.balance = feeRecord.totalFees - feeRecord.amountPaid;

    if (feeRecord.balance <= 0) {
      feeRecord.status = "PAID"; // balance <= 0 covers exact payment AND overpayment
    } else if (feeRecord.amountPaid > 0) {
      feeRecord.status = "PARTIAL";
    } else {
      feeRecord.status = "UNPAID";
    }

    await feeRecord.save();

    res.json({
      success: true,
      message: "Fee record updated successfully",
      feeRecord
    });
  } catch (error) {
    console.error("Update fee error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ==================== DELETE FEE RECORD ====================
exports.deleteFee = async (req, res) => {
  try {
    const { id } = req.params;

    const feeRecord = await SchoolFee.findOneAndDelete({
      _id: id,
      school: req.user.schoolId
    });

    if (!feeRecord) {
      return res.status(404).json({
        success: false,
        message: "Fee record not found"
      });
    }

    res.json({
      success: true,
      message: "Fee record deleted successfully"
    });
  } catch (error) {
    console.error("Delete fee error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};