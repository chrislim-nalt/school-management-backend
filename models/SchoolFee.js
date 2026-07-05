// models/SchoolFee.js
const mongoose = require("mongoose");

const schoolFeeSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  studentName: { type: String, required: true },
  studentId: { type: String, required: true },
  grade: { type: String, required: true },
  className: { type: String, required: true },
  
  totalFees: { type: Number, required: true, default: 0 },
  amountPaid: { type: Number, default: 0 },
  balance: { type: Number, default: 0 },
  
  term: { type: String, enum: ["TERM1", "TERM2", "TERM3"], required: true },
  academicYear: { type: Number, required: true },
  
  payments: [{
    amount: { type: Number, required: true },
    paymentDate: { type: Date, default: Date.now },
    paymentMethod: { 
      type: String, 
      enum: ["CASH", "MOBILE_MONEY", "BANK_TRANSFER", "CHEQUE"],
      default: "CASH"
    },
    reference: { type: String, default: "" },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    recordedByName: { type: String, default: "" },
    notes: { type: String, default: "" }
  }],
  
  status: { 
    type: String, 
    enum: ["PAID", "PARTIAL", "UNPAID", "OVERDUE"],
    default: "UNPAID"
  },
  
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true }
}, { timestamps: true });

// Indexes for performance
schoolFeeSchema.index({ student: 1, term: 1, academicYear: 1 });
schoolFeeSchema.index({ school: 1, status: 1 });
schoolFeeSchema.index({ school: 1, grade: 1, className: 1 });
schoolFeeSchema.index({ balance: -1 });

module.exports = mongoose.model("SchoolFee", schoolFeeSchema);