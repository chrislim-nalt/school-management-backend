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
    
    // Get all students for this school with studentId that starts with "STD-"
    const students = await Student.find({ 
      school: schoolId,
      isDeleted: false,
      studentId: { $regex: /^STD-/ } // Match any studentId starting with STD-
    }).select('studentId');
    
    let maxId = 0;
    for (const student of students) {
      if (student.studentId) {
        // Extract numbers from studentId (handles STD-0001, STD-1, STD-1234, etc.)
        const match = student.studentId.match(/STD-(\d+)/);
        if (match && match[1]) {
          const num = parseInt(match[1]);
          if (!isNaN(num) && num > maxId) {
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
studentSchema.statics.getNextStudentId = async function(schoolId, maxRetries = 5) {
  let attempts = 0;
  
  while (attempts < maxRetries) {
    try {
      // Generate a candidate ID
      const candidateId = await this.generateStudentId(schoolId);
      console.log(`[Attempt ${attempts + 1}] Generated candidate ID: ${candidateId}`);
      
      // Check if it already exists (including deleted students to avoid conflicts)
      const existing = await this.findOne({ 
        school: schoolId, 
        studentId: candidateId
      });
      
      if (!existing) {
        console.log(`[Attempt ${attempts + 1}] ID ${candidateId} is available`);
        return candidateId; // ID is unique, return it
      }
      
      console.log(`[Attempt ${attempts + 1}] ID ${candidateId} already exists, retrying...`);
      
      // Force find max numeric ID by scanning ALL student IDs (including deleted)
      const allStudents = await this.find({ 
        school: schoolId
      }).select('studentId');
      
      let maxId = 0;
      for (const student of allStudents) {
        if (student.studentId) {
          const match = student.studentId.match(/STD-(\d+)/);
          if (match && match[1]) {
            const num = parseInt(match[1]);
            if (!isNaN(num) && num > maxId) {
              maxId = num;
            }
          }
        }
      }
      
      console.log(`[Attempt ${attempts + 1}] Found max ID: ${maxId}`);
      
      // Try with the forced max + 1
      const forcedId = maxId + 1;
      const paddedForcedId = String(forcedId).padStart(4, '0');
      const forcedCandidate = `STD-${paddedForcedId}`;
      
      console.log(`[Attempt ${attempts + 1}] Trying forced ID: ${forcedCandidate}`);
      
      // Check if this one exists
      const existingForced = await this.findOne({ 
        school: schoolId, 
        studentId: forcedCandidate
      });
      
      if (!existingForced) {
        console.log(`[Attempt ${attempts + 1}] Forced ID ${forcedCandidate} is available`);
        return forcedCandidate;
      }
      
      attempts++;
    } catch (error) {
      console.error("Error in getNextStudentId:", error);
      attempts++;
    }
  }
  
  // Last resort: use timestamp with high precision
  const timestamp = Date.now().toString().slice(-8);
  const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  const finalId = `STD-${timestamp}${randomSuffix}`;
  console.log(`All retries failed, using timestamp-based ID: ${finalId}`);
  return finalId;
};

// Indexes
studentSchema.index({ school: 1, studentId: 1 });
studentSchema.index({ school: 1, grade: 1, className: 1 });
studentSchema.index({ school: 1, status: 1 });
studentSchema.index({ name: 1 });

module.exports = mongoose.model("Student", studentSchema);