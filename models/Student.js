const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({
  studentId: { type: String, unique: true },
  name: { type: String, required: true, trim: true },
  grade: { type: String, required: true },
  className: { type: String, required: true },
  school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
  
  // Personal Information
  dateOfBirth: { type: Date, default: null },
  gender: { type: String, enum: ["MALE", "FEMALE"], default: "MALE" },
  address: { type: String, default: "" },
  
  // Parent/Guardian Information
  parentName: { type: String, default: "" },
  parentPhone: { type: String, default: "" },
  parentEmail: { type: String, default: "" },
  parentOccupation: { type: String, default: "" },
  parentAddress: { type: String, default: "" },
  
  // Emergency Contact
  emergencyContact: { type: String, default: "" },
  emergencyContactPhone: { type: String, default: "" },
  emergencyRelationship: { type: String, default: "" },
  
  // Medical Information
  medicalInfo: { type: String, default: "" },
  allergies: { type: String, default: "" },
  bloodGroup: { type: String, default: "" },
  
  // Academic Information
  previousSchool: { type: String, default: "" },
  
  // Transport
  transportSubscribed: { type: Boolean, default: false },
  transportRoute: { type: String, default: "" },
  transportPickupPoint: { type: String, default: "" },
  transportDropoffPoint: { type: String, default: "" },
  
  // Status
  status: { type: String, enum: ["ACTIVE", "INACTIVE", "GRADUATED", "TRANSFERRED"], default: "ACTIVE" },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

// NO PRE-SAVE HOOK - Handle ID generation in the controller instead
// This avoids the "next is not a function" error

// Static method to generate student ID - called from controller
studentSchema.statics.generateStudentId = async function(schoolId) {
  try {
    const Student = this;
    const lastStudent = await Student.findOne({ 
      school: schoolId,
      isDeleted: false
    }).sort({ studentId: -1 }).limit(1);
    
    let lastId = 0;
    if (lastStudent && lastStudent.studentId) {
      const match = lastStudent.studentId.match(/\d+/);
      if (match) {
        lastId = parseInt(match[0]);
      }
    }
    
    const newId = lastId + 1;
    const paddedId = String(newId).padStart(4, '0');
    return `STD-${paddedId}`;
  } catch (error) {
    console.error("Error generating student ID:", error);
    const timestamp = Date.now().toString().slice(-8);
    return `STD-${timestamp}`;
  }
};

// Indexes
studentSchema.index({ school: 1, studentId: 1 });
studentSchema.index({ school: 1, grade: 1, className: 1 });
studentSchema.index({ school: 1, status: 1 });
studentSchema.index({ name: 1 });

module.exports = mongoose.model("Student", studentSchema);