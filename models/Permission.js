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

// NO PRE-SAVE HOOKS - Calculate in controller instead
// This avoids the "next is not a function" error

// Indexes
permissionSchema.index({ teacher: 1, status: 1 });
permissionSchema.index({ school: 1, createdAt: -1 });
permissionSchema.index({ startDate: 1, endDate: 1 });

module.exports = mongoose.model("Permission", permissionSchema);