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
    
    // Get all students for this school and extract numeric IDs
    const students = await Student.find({ 
      school: schoolId,
      isDeleted: false,
      studentId: { $regex: /^STD-\d+$/ } // Only match valid student IDs
    }).select('studentId');
    
    let maxId = 0;
    for (const student of students) {
      if (student.studentId) {
        const match = student.studentId.match(/\d+/);
        if (match) {
          const num = parseInt(match[0]);
          if (num > maxId) {
            maxId = num;
          }
        }
      }
    }
    
    const newId = maxId + 1;
    const paddedId = String(newId).padStart(4, '0');
    return `STD-${paddedId}`;
  } catch (error) {
    console.error("Error generating student ID:", error);
    // Fallback to timestamp-based ID
    const timestamp = Date.now().toString().slice(-8);
    return `STD-${timestamp}`;
  }
};

// Static method to get next student ID with retry on conflict
studentSchema.statics.getNextStudentId = async function(schoolId, maxRetries = 3) {
  let attempts = 0;
  while (attempts < maxRetries) {
    try {
      // Generate a candidate ID
      const candidateId = await this.generateStudentId(schoolId);
      
      // Check if it already exists
      const existing = await this.findOne({ 
        school: schoolId, 
        studentId: candidateId,
        isDeleted: false 
      });
      
      if (!existing) {
        return candidateId; // ID is unique, return it
      }
      
      // If duplicate, force increment by finding max numeric ID
      attempts++;
      console.log(`ID ${candidateId} already exists, retry ${attempts}`);
      
      // Force find max numeric ID by scanning all student IDs
      const allStudents = await this.find({ 
        school: schoolId,
        isDeleted: false 
      }).select('studentId');
      
      let maxId = 0;
      for (const student of allStudents) {
        if (student.studentId) {
          const match = student.studentId.match(/\d+/);
          if (match) {
            const num = parseInt(match[0]);
            if (num > maxId) maxId = num;
          }
        }
      }
      
      // Try with the forced max + 1
      const forcedId = maxId + 1;
      const paddedForcedId = String(forcedId).padStart(4, '0');
      const forcedCandidate = `STD-${paddedForcedId}`;
      
      // Check if this one exists
      const existingForced = await this.findOne({ 
        school: schoolId, 
        studentId: forcedCandidate,
        isDeleted: false 
      });
      
      if (!existingForced) {
        return forcedCandidate;
      }
    } catch (error) {
      console.error("Error in getNextStudentId:", error);
      attempts++;
    }
  }
  
  // Last resort: use timestamp
  const timestamp = Date.now().toString().slice(-8);
  return `STD-${timestamp}`;
};

// Indexes
studentSchema.index({ school: 1, studentId: 1 });
studentSchema.index({ school: 1, grade: 1, className: 1 });
studentSchema.index({ school: 1, status: 1 });
studentSchema.index({ name: 1 });

module.exports = mongoose.model("Student", studentSchema);