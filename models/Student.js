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

// Static method to generate student ID - FIXED with proper error handling
studentSchema.statics.generateStudentId = async function(schoolId) {
  try {
    const Student = this;
    
    // Find the last student for this school
    const lastStudent = await Student.findOne({ 
      school: schoolId,
      isDeleted: false
    }).sort({ studentId: -1 }).limit(1);
    
    let lastId = 0;
    if (lastStudent && lastStudent.studentId) {
      // Extract the numeric part from studentId (e.g., STD-0001 -> 1)
      const match = lastStudent.studentId.match(/\d+/);
      if (match) {
        lastId = parseInt(match[0]);
      }
    }
    
    // Increment and pad with zeros
    const newId = lastId + 1;
    const paddedId = String(newId).padStart(4, '0');
    const generatedId = `STD-${paddedId}`;
    
    console.log(`Generated student ID: ${generatedId} (from lastId: ${lastId})`);
    return generatedId;
  } catch (error) {
    console.error("Error generating student ID:", error);
    // Fallback: use timestamp based ID
    const timestamp = Date.now().toString().slice(-8);
    return `STD-${timestamp}`;
  }
};

// Pre-save middleware to ensure studentId is set
studentSchema.pre('save', async function(next) {
  try {
    // If studentId is not set or is empty, generate one
    if (!this.studentId || this.studentId === '' || this.studentId === 'STD-0000') {
      console.log("Generating student ID for new student...");
      this.studentId = await this.constructor.generateStudentId(this.school);
    }
    next();
  } catch (error) {
    console.error("Error in pre-save middleware:", error);
    next(error);
  }
});

// Indexes
studentSchema.index({ school: 1, studentId: 1 });
studentSchema.index({ school: 1, grade: 1, className: 1 });
studentSchema.index({ school: 1, status: 1 });
studentSchema.index({ name: 1 });

module.exports = mongoose.model("Student", studentSchema);