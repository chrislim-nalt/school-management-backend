const mongoose = require("mongoose");

const visitorSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  email: { type: String, default: "", trim: true, lowercase: true },
  reasonForVisit: { type: String, required: true, trim: true },
  reasonCategory: { 
    type: String, 
    enum: ["PARENT_CLAIM", "INFORMATION_SEEKING", "MEETING", "DELIVERY", "MAINTENANCE", "OTHER"], 
    default: "OTHER" 
  },
  personToMeet: { type: String, default: "", trim: true },
  checkInTime: { type: Date, default: Date.now },
  checkOutTime: { type: Date, default: null },
  durationMinutes: { type: Number, default: 0 },
  notes: { type: String, default: "", trim: true },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  recordedByName: { type: String, default: "" },
  status: {
    type: String,
    enum: ["ACTIVE", "CHECKED_OUT"],
    default: "ACTIVE"
  },
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true }
}, { timestamps: true });

// NO pre-save middleware - we'll handle duration calculation in the controller

// Indexes for efficient queries
visitorSchema.index({ school: 1, checkInTime: -1 });
visitorSchema.index({ school: 1, status: 1 });
visitorSchema.index({ school: 1, reasonCategory: 1 });
visitorSchema.index({ name: 1, phone: 1 });

module.exports = mongoose.model("Visitor", visitorSchema);