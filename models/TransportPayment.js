const mongoose = require("mongoose");

const transportPaymentSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  studentName: { type: String, required: true },
  studentId: { type: String, required: true },
  grade: { type: String, required: true },
  className: { type: String, required: true },
  semester: { type: String, enum: ["TERM1", "TERM2", "TERM3"], required: true },
  year: { type: Number, required: true },
  amount: { type: Number, required: true, min: 0 },
  amountPaid: { type: Number, default: 0, min: 0 },
  balance: { type: Number, default: 0 },
  status: { type: String, enum: ["PAID", "PARTIAL", "UNPAID"], default: "UNPAID" },
  paymentDate: { type: Date },
  paymentMethod: { type: String, enum: ["CASH", "MOBILE_MONEY", "BANK_TRANSFER", "CHEQUE"], default: "CASH" },
  reference: { type: String, default: "" },
  notes: { type: String, default: "" },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  recordedByName: { type: String, default: "" },
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true }
}, { timestamps: true });

// NO PRE-SAVE HOOK - We'll handle calculations in the controller
// This avoids the "next is not a function" error

// Indexes for better performance
transportPaymentSchema.index({ school: 1, semester: 1, year: 1 });
transportPaymentSchema.index({ school: 1, grade: 1, className: 1 });
transportPaymentSchema.index({ student: 1, school: 1 });
transportPaymentSchema.index({ status: 1, school: 1 });

module.exports = mongoose.model("TransportPayment", transportPaymentSchema);