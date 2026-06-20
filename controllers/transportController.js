const TransportPayment = require("../models/TransportPayment");
const TransportRecord = require("../models/TransportRecord");
const Student = require("../models/Student");
const mongoose = require("mongoose");

// ==================== STUDENT FILTERING ====================

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
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getSchoolClasses = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: "School ID not found for this user"
      });
    }

    console.log("Fetching classes for school:", schoolId);
    
    const classes = await Student.aggregate([
      { 
        $match: { 
          school: new mongoose.Types.ObjectId(schoolId), 
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
    
    console.log("Found classes:", classes.length);
    
    res.json({
      success: true,
      classes: classes || []
    });
  } catch (error) {
    console.error("Get school classes error:", error);
    res.status(500).json({ 
      success: false, 
      message: error.message
    });
  }
};

// ==================== TRANSPORT PAYMENTS ====================

exports.getTransportPayments = async (req, res) => {
  try {
    const { semester, year, grade, className, status } = req.query;
    const schoolId = req.user.schoolId;
    
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: "School ID not found for this user"
      });
    }
    
    let filter = { school: schoolId };
    
    if (semester) filter.semester = semester;
    if (year) filter.year = parseInt(year);
    if (status) filter.status = status;
    if (grade && grade !== "ALL") filter.grade = grade;
    if (className && className !== "ALL") filter.className = className;
    
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
    res.status(500).json({ success: false, message: error.message });
  }
};

// Helper function to calculate payment status
const calculatePaymentStatus = (amount, amountPaid) => {
  const balance = Math.max(0, amount - amountPaid);
  let status = "UNPAID";
  if (balance <= 0) {
    status = "PAID";
  } else if (amountPaid > 0 && balance > 0) {
    status = "PARTIAL";
  }
  return { balance, status };
};

exports.createTransportPayment = async (req, res) => {
  try {
    console.log("=== CREATE TRANSPORT PAYMENT ===");
    console.log("Request body:", req.body);
    console.log("User:", req.user);
    
    const schoolId = req.user.schoolId;
    
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: "School ID not found for this user"
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
    const student = await Student.findOne({ _id: studentId, school: schoolId });
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }
    
    console.log("Found student:", student.name, student.studentId);
    
    // Check if payment already exists
    const existingPayment = await TransportPayment.findOne({
      student: studentId,
      semester,
      year: parseInt(year),
      school: schoolId
    });
    
    if (existingPayment) {
      return res.status(400).json({ 
        success: false, 
        message: `Payment record already exists for ${student.name} for ${semester} ${year}. Use update instead.` 
      });
    }
    
    const finalAmountPaid = amountPaid ? parseFloat(amountPaid) : 0;
    const finalAmount = parseFloat(amount);
    
    // Calculate balance and status using helper
    const { balance, status } = calculatePaymentStatus(finalAmount, finalAmountPaid);
    
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
      balance: balance,
      status: status,
      paymentMethod: paymentMethod || "CASH",
      reference: reference || "",
      notes: notes || "",
      paymentDate: finalAmountPaid > 0 ? new Date() : null,
      recordedBy: req.user.id,
      recordedByName: req.user.name || req.user.email || "Unknown",
      school: schoolId
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
    
    // Populate student data before returning
    const populatedPayment = await TransportPayment.findById(payment._id)
      .populate('student', 'name studentId grade className');
    
    res.status(201).json({
      success: true,
      message: "Transport payment recorded successfully",
      payment: populatedPayment || payment
    });
  } catch (error) {
    console.error("Create transport payment error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateTransportPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { studentId, semester, year, amount, amountPaid, paymentMethod, reference, notes } = req.body;
    const schoolId = req.user.schoolId;
    
    console.log("=== UPDATE TRANSPORT PAYMENT ===");
    console.log("Payment ID:", id);
    console.log("Update data:", req.body);
    console.log("School ID:", schoolId);
    
    // Validate school ID
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: "School ID not found for this user"
      });
    }
    
    // Validate payment ID
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Payment ID is required"
      });
    }
    
    // Find the payment
    let payment;
    try {
      payment = await TransportPayment.findOne({ _id: id, school: schoolId });
    } catch (err) {
      console.error("Error finding payment:", err);
      return res.status(500).json({
        success: false,
        message: "Error finding payment: " + err.message
      });
    }
    
    if (!payment) {
      console.log("Payment not found with ID:", id);
      return res.status(404).json({ 
        success: false, 
        message: "Payment not found" 
      });
    }
    
    console.log("Current payment before update:", {
      id: payment._id,
      amount: payment.amount,
      amountPaid: payment.amountPaid,
      balance: payment.balance,
      status: payment.status
    });
    
    // Prepare update object
    const updateFields = {};
    
    // Handle amount - THIS IS THE KEY FIX
    if (amount !== undefined && amount !== null && amount !== '') {
      const newAmount = parseFloat(amount);
      console.log("Parsed amount:", newAmount, "Type:", typeof newAmount);
      
      if (!isNaN(newAmount) && newAmount > 0) {
        updateFields.amount = newAmount;
        console.log("Will update amount to:", newAmount);
      } else {
        console.log("Invalid amount value:", amount);
      }
    }
    
    // Handle amountPaid
    if (amountPaid !== undefined && amountPaid !== null && amountPaid !== '') {
      const newAmountPaid = parseFloat(amountPaid);
      console.log("Parsed amountPaid:", newAmountPaid, "Type:", typeof newAmountPaid);
      
      if (!isNaN(newAmountPaid) && newAmountPaid >= 0) {
        updateFields.amountPaid = newAmountPaid;
        console.log("Will update amountPaid to:", newAmountPaid);
      } else {
        console.log("Invalid amountPaid value:", amountPaid);
        return res.status(400).json({
          success: false,
          message: "Invalid amount paid value"
        });
      }
    }
    
    // If amount was updated, we need to recalculate balance and status
    // Use the updated amount or the existing one
    const finalAmount = updateFields.amount || payment.amount;
    const finalAmountPaid = updateFields.amountPaid || payment.amountPaid;
    
    // Calculate new balance and status
    const { balance, status } = calculatePaymentStatus(finalAmount, finalAmountPaid);
    updateFields.balance = balance;
    updateFields.status = status;
    console.log("Calculated balance:", balance, "Status:", status);
    
    // Handle semester
    if (semester) {
      updateFields.semester = semester;
      console.log("Will update semester to:", semester);
    }
    
    // Handle year
    if (year) {
      updateFields.year = parseInt(year);
      console.log("Will update year to:", year);
    }
    
    // Handle studentId
    if (studentId) {
      // Verify student exists
      const student = await Student.findOne({ _id: studentId, school: schoolId });
      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Student not found"
        });
      }
      updateFields.student = studentId;
      updateFields.studentName = student.name;
      updateFields.studentId = student.studentId;
      updateFields.grade = student.grade;
      updateFields.className = student.className;
      console.log("Will update student to:", studentId);
    }
    
    // Handle paymentMethod
    if (paymentMethod) {
      updateFields.paymentMethod = paymentMethod;
      console.log("Will update paymentMethod to:", paymentMethod);
    }
    
    // Handle reference
    if (reference !== undefined) {
      updateFields.reference = reference;
      console.log("Will update reference to:", reference);
    }
    
    // Handle notes
    if (notes !== undefined) {
      updateFields.notes = notes;
      console.log("Will update notes to:", notes);
    }
    
    // Set payment date if payment was made and no date exists
    if (updateFields.amountPaid && updateFields.amountPaid > 0 && !payment.paymentDate) {
      updateFields.paymentDate = new Date();
      console.log("Will set payment date to:", updateFields.paymentDate);
    }
    
    // Check if we have any fields to update
    if (Object.keys(updateFields).length === 0) {
      console.log("No changes to update");
      return res.status(400).json({
        success: false,
        message: "No valid fields to update"
      });
    }
    
    console.log("Final update fields:", updateFields);
    
    // Save the updated payment using findByIdAndUpdate
    try {
      const updatedPayment = await TransportPayment.findByIdAndUpdate(
        id,
        { $set: updateFields },
        { new: true, runValidators: true }
      ).populate('student', 'name studentId grade className');
      
      console.log("Updated payment result:", {
        id: updatedPayment._id,
        amount: updatedPayment.amount,
        amountPaid: updatedPayment.amountPaid,
        balance: updatedPayment.balance,
        status: updatedPayment.status
      });
      
      // Update student transport subscription
      try {
        const student = await Student.findById(updatedPayment.student);
        if (student) {
          if (updatedPayment.status === "PAID") {
            student.transportSubscribed = true;
            await student.save();
            console.log("Student transport subscription set to true");
          } else {
            // Check if student has any other paid transport payments
            const otherPaidPayments = await TransportPayment.findOne({
              student: updatedPayment.student,
              status: "PAID",
              _id: { $ne: updatedPayment._id }
            });
            if (!otherPaidPayments) {
              student.transportSubscribed = false;
              await student.save();
              console.log("Student transport subscription set to false");
            }
          }
        }
      } catch (studentError) {
        console.error("Error updating student subscription:", studentError);
        // Don't fail the whole request if student update fails
      }
      
      res.json({
        success: true,
        message: "Payment updated successfully",
        payment: updatedPayment
      });
      
    } catch (saveError) {
      console.error("Error saving payment:", saveError);
      return res.status(500).json({
        success: false,
        message: "Error saving payment: " + saveError.message
      });
    }
    
  } catch (error) {
    console.error("Update transport payment error - DETAILS:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ 
      success: false, 
      message: error.message || "Internal server error",
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

exports.deleteTransportPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;
    
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: "School ID not found for this user"
      });
    }
    
    const payment = await TransportPayment.findOne({ _id: id, school: schoolId });
    
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }
    
    // Update student transport subscription
    const student = await Student.findById(payment.student);
    if (student && payment.status === "PAID") {
      const otherPaidPayments = await TransportPayment.findOne({
        student: payment.student,
        status: "PAID",
        _id: { $ne: payment._id }
      });
      if (!otherPaidPayments) {
        student.transportSubscribed = false;
        await student.save();
      }
    }
    
    await TransportPayment.deleteOne({ _id: id, school: schoolId });
    
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

exports.getTransportRecords = async (req, res) => {
  try {
    const { startDate, endDate, grade, className, student } = req.query;
    const schoolId = req.user.schoolId;
    
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: "School ID not found for this user"
      });
    }
    
    let filter = { school: schoolId };
    
    if (startDate && endDate) {
      filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    if (grade && grade !== "ALL") filter.grade = grade;
    if (className && className !== "ALL") filter.className = className;
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
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createTransportRecord = async (req, res) => {
  try {
    const { studentId, date, pickupLocation, dropoffLocation, distance, status, notes } = req.body;
    const schoolId = req.user.schoolId;
    
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: "School ID not found for this user"
      });
    }
    
    if (!studentId) {
      return res.status(400).json({ success: false, message: "Student ID is required" });
    }
    
    const student = await Student.findOne({ _id: studentId, school: schoolId });
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }
    
    // Check for duplicate record on same day
    const recordDate = new Date(date || Date.now());
    recordDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(recordDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    const existingRecord = await TransportRecord.findOne({
      student: studentId,
      date: { $gte: recordDate, $lt: nextDay },
      school: schoolId
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

exports.deleteTransportRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user.schoolId;
    
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: "School ID not found for this user"
      });
    }
    
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

exports.getTransportFinancialSummary = async (req, res) => {
  try {
    const { year, semester } = req.query;
    const schoolId = req.user.schoolId;
    
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: "School ID not found for this user"
      });
    }
    
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

exports.getTermPaymentsReport = async (req, res) => {
  try {
    const { term, year, grade, className } = req.query;
    const schoolId = req.user.schoolId;
    
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: "School ID not found for this user"
      });
    }
    
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

exports.getOutstandingPayments = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: "School ID not found for this user"
      });
    }
    
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

exports.getStudentTransportHistory = async (req, res) => {
  try {
    const { studentId } = req.params;
    const schoolId = req.user.schoolId;
    
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: "School ID not found for this user"
      });
    }
    
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