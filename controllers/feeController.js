// controllers/feeController.js
const SchoolFee = require("../models/SchoolFee");
const Student = require("../models/Student");

// ==================== FOLLOW-UP OVERDUE AUTO-DETECTION ====================
// A record is "follow-up overdue" when there's still a balance owed, a
// promise date was set, and that date has passed. Rather than relying on
// a cron job, we check this every time records are read and persist the
// status flip to "OVERDUE" so it's reflected everywhere immediately —
// dashboards, exports, the debtors list — without any background worker.
async function flagOverdueFollowUps(records) {
  const now = new Date();
  const toUpdate = [];

  for (const r of records) {
    const hasPromise = r.balance > 0 && r.followUp?.promiseDate;
    const isPastDue = hasPromise && new Date(r.followUp.promiseDate) < now;
    if (isPastDue && r.status !== "OVERDUE") {
      r.status = "OVERDUE";
      toUpdate.push(r.save());
    }
  }

  if (toUpdate.length > 0) {
    await Promise.all(toUpdate);
  }
  return records;
}

// Attaches read-only follow-up info to each record for the frontend:
// isFollowUpOverdue, and how many days overdue / remaining.
function annotateFollowUp(record) {
  const obj = record.toObject ? record.toObject() : record;
  const promiseDate = obj.followUp?.promiseDate;

  if (obj.balance > 0 && promiseDate) {
    const now = new Date();
    const due = new Date(promiseDate);
    const diffDays = Math.round((due - now) / (1000 * 60 * 60 * 24));
    obj.isFollowUpOverdue = diffDays < 0;
    obj.daysOverdue = diffDays < 0 ? Math.abs(diffDays) : 0;
    obj.daysUntilDue = diffDays >= 0 ? diffDays : 0;
  } else {
    obj.isFollowUpOverdue = false;
    obj.daysOverdue = 0;
    obj.daysUntilDue = null;
  }
  return obj;
}

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
      notes,
      parentName,
      parentPhone,
      promiseDate
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

      // Follow-up info only matters while a balance remains. Once fully
      // paid (or overpaid), there's nothing left to chase, so clear it.
      if (feeRecord.balance <= 0) {
        feeRecord.followUp = { parentName: "", parentPhone: "", promiseDate: null, notes: "" };
      } else if (parentName || parentPhone || promiseDate) {
        feeRecord.followUp = {
          parentName: parentName || feeRecord.followUp?.parentName || "",
          parentPhone: parentPhone || feeRecord.followUp?.parentPhone || "",
          promiseDate: promiseDate ? new Date(promiseDate) : (feeRecord.followUp?.promiseDate || null),
          notes: notes || feeRecord.followUp?.notes || ""
        };
      }
    } else {
      // Create new record
      const balance = total - paidAmount;
      feeRecord = new SchoolFee({
        student: studentId,
        studentName: student.name,
        studentId: student.studentId,
        grade: student.grade,
        className: student.className,
        totalFees: total,
        amountPaid: paidAmount,
        balance: balance,
        term: term,
        academicYear: year,
        school: req.user.schoolId,
        status: total > 0 && paidAmount >= total ? "PAID" : (paidAmount > 0 ? "PARTIAL" : "UNPAID"),
        followUp: balance > 0 ? {
          parentName: parentName || "",
          parentPhone: parentPhone || "",
          promiseDate: promiseDate ? new Date(promiseDate) : null,
          notes: notes || ""
        } : undefined
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
    
    let records = await SchoolFee.find(filter)
      .populate("student", "name studentId")
      .sort({ balance: -1 });

    await flagOverdueFollowUps(records);
    records = records.map(annotateFollowUp);
    
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
      overdue: records.filter(r => r.status === "OVERDUE").length,
      followUpOverdue: records.filter(r => r.isFollowUpOverdue).length
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

    await flagOverdueFollowUps(records);
    const annotated = records.map(annotateFollowUp);
    
    const totalOutstanding = annotated.reduce((sum, r) => sum + r.balance, 0);
    
    res.json({
      success: true,
      records: annotated,
      totalOutstanding,
      count: annotated.length
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
    
    let records = await SchoolFee.find({
      student: studentId,
      school: req.user.schoolId
    }).sort({ academicYear: -1, term: -1 });

    await flagOverdueFollowUps(records);
    records = records.map(annotateFollowUp);
    
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

// ==================== PAYMENT FOLLOW-UPS (PARTIAL/UNPAID PROMISES) ====================
// Powers the "Follow-Up" panel: every record that still has a balance and
// a promise date on file, sorted so overdue ones surface first. This is
// also what the automatic notification banner counts against.
exports.getPaymentFollowUps = async (req, res) => {
  try {
    const { grade, className, overdueOnly } = req.query;

    let filter = {
      school: req.user.schoolId,
      balance: { $gt: 0 },
      "followUp.promiseDate": { $ne: null }
    };
    if (grade) filter.grade = grade;
    if (className) filter.className = className;

    const records = await SchoolFee.find(filter).sort({ "followUp.promiseDate": 1 });

    await flagOverdueFollowUps(records);
    let annotated = records.map(annotateFollowUp);

    if (overdueOnly === "true") {
      annotated = annotated.filter(r => r.isFollowUpOverdue);
    }

    const overdueCount = annotated.filter(r => r.isFollowUpOverdue).length;

    res.json({
      success: true,
      records: annotated,
      overdueCount,
      count: annotated.length
    });
  } catch (error) {
    console.error("Get payment follow-ups error:", error);
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
    const { totalFees, amountPaid, term, academicYear, notes, parentName, parentPhone, promiseDate } = req.body;

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
      // Nothing left to follow up on once fully paid/overpaid.
      feeRecord.followUp = { parentName: "", parentPhone: "", promiseDate: null, notes: "" };
    } else {
      if (feeRecord.amountPaid > 0) {
        feeRecord.status = "PARTIAL";
      } else {
        feeRecord.status = "UNPAID";
      }
      feeRecord.followUp = {
        parentName: parentName !== undefined ? parentName : (feeRecord.followUp?.parentName || ""),
        parentPhone: parentPhone !== undefined ? parentPhone : (feeRecord.followUp?.parentPhone || ""),
        promiseDate: promiseDate !== undefined
          ? (promiseDate ? new Date(promiseDate) : null)
          : (feeRecord.followUp?.promiseDate || null),
        notes: feeRecord.followUp?.notes || ""
      };
    }

    await feeRecord.save();

    res.json({
      success: true,
      message: "Fee record updated successfully",
      feeRecord: annotateFollowUp(feeRecord)
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