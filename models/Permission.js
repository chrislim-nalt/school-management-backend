const mongoose = require("mongoose");

const permissionSchema = new mongoose.Schema({
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
  teacherName: { type: String, required: true },
  teacherEmail: { type: String, required: true },
  reason: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { 
    type: String, 
    enum: ["PENDING", "APPROVED", "DISAPPROVED", "REVOKED"], 
    default: "PENDING" 
  },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  approvedByName: { type: String, default: "" },
  approvedAt: { type: Date },
  rejectionReason: { type: String, default: "" },
  totalDays: { type: Number, default: 0 },
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true }
}, { timestamps: true });

// Auto-calculate total days before save
permissionSchema.pre('save', function(next) {
  if (this.startDate && this.endDate) {
    const diffTime = Math.abs(this.endDate - this.startDate);
    this.totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }
  next();
});

// Ensure permission doesn't exceed 7 days
permissionSchema.pre('validate', function(next) {
  if (this.startDate && this.endDate) {
    const diffTime = Math.abs(this.endDate - this.startDate);
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    if (days > 7) {
      next(new Error("Permission cannot exceed 7 days"));
    }
  }
  next();
});

module.exports = mongoose.model("Permission", permissionSchema);