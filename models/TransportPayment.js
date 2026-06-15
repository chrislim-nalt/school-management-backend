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
  paymentMethod: { type: String, enum: ["CASH", "MOBILE_MONEY", "BANK_TRANSFER"], default: "CASH" },
  reference: { type: String, default: "" },
  notes: { type: String, default: "" },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  recordedByName: { type: String, default: "" },
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true }
}, { timestamps: true });

// Calculate balance before saving
transportPaymentSchema.pre('save', function(next) {
  this.balance = this.amount - this.amountPaid;
  if (this.balance <= 0) {
    this.status = "PAID";
    this.balance = 0;
  } else if (this.amountPaid > 0 && this.balance > 0) {
    this.status = "PARTIAL";
  }
  next();
});

// Indexes
transportPaymentSchema.index({ school: 1, semester: 1, year: 1 });
transportPaymentSchema.index({ school: 1, grade: 1, className: 1 });
transportPaymentSchema.index({ student: 1 });

module.exports = mongoose.model("TransportPayment", transportPaymentSchema);