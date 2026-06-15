const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({
    // Basic Information
    studentId: { type: String, unique: true },
    name: { type: String, required: true },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ["MALE", "FEMALE"], default: "MALE" },
    address: { type: String, default: "" },
    
    // Academic Information
    grade: { type: String, required: true },
    className: { type: String, required: true },
    enrollmentDate: { type: Date, default: Date.now },
    status: { 
        type: String, 
        enum: ["ACTIVE", "INACTIVE", "GRADUATED", "TRANSFERRED"], 
        default: "ACTIVE" 
    },
    
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
    bloodGroup: { type: String, enum: ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-", ""], default: "" },
    
    // Previous School
    previousSchool: { type: String, default: "" },
    
    // Transport Information
    transportSubscribed: { type: Boolean, default: false },
    transportRoute: { type: String, default: "" },
    transportPickupPoint: { type: String, default: "" },
    transportDropoffPoint: { type: String, default: "" },
    
    // ========== CONDUCT TRACKING ==========
    currentConductScore: { type: Number, default: 40, min: 0, max: 40 },
    conductHistory: [{
        semester: { type: String, enum: ["TERM1", "TERM2", "TERM3"] },
        academicYear: { type: Number },
        score: { type: Number, min: 0, max: 40 },
        offensesCount: { type: Number, default: 0 },
        updatedAt: { type: Date, default: Date.now }
    }],
    
    // ========== ENGLISH PERFORMANCE TRACKING ==========
    englishViolationCount: { type: Number, default: 0 },
    englishPerformanceHistory: [{
        semester: { type: String, enum: ["TERM1", "TERM2", "TERM3"] },
        academicYear: { type: Number },
        violationCount: { type: Number, default: 0 },
        status: { type: String, enum: ["GREEN", "YELLOW", "RED"], default: "GREEN" }
    }],
    lastEnglishViolation: { type: Date },
    
    // ========== ACADEMIC PERFORMANCE ==========
    academicSummary: {
        overallAverage: { type: Number, default: 0 },
        rankInClass: { type: Number },
        totalStudentsInClass: { type: Number },
        lastUpdated: { type: Date }
    },
    
    // Course-specific performance tracking
    coursePerformance: [{
        course: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
        courseName: { type: String },
        averageScore: { type: Number, default: 0 },
        term: { type: String, enum: ["TERM1", "TERM2", "TERM3"] },
        academicYear: { type: Number }
    }],
    
    // ========== ATTENDANCE SUMMARY ==========
    attendanceSummary: {
        totalDays: { type: Number, default: 0 },
        presentDays: { type: Number, default: 0 },
        absentDays: { type: Number, default: 0 },
        lateDays: { type: Number, default: 0 },
        attendanceRate: { type: Number, default: 0 }
    },
    
    // ========== SYSTEM FIELDS ==========
    school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
    
    // For soft deletion
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }

}, { timestamps: true });

// ========== REMOVED ALL MIDDLEWARE - We'll generate ID in controller ==========

// ========== INSTANCE METHODS ==========

// Update conduct score for current semester
studentSchema.methods.updateConductScore = function(newScore) {
    this.currentConductScore = Math.max(0, Math.min(40, newScore));
    return this.currentConductScore;
};

// Add conduct history record
studentSchema.methods.addConductHistory = function(semester, academicYear, score, offensesCount) {
    this.conductHistory.push({
        semester,
        academicYear,
        score,
        offensesCount,
        updatedAt: new Date()
    });
    return this;
};

// Update English performance
studentSchema.methods.updateEnglishPerformance = function(semester, academicYear) {
    const violationCount = this.englishViolationCount;
    let status = "GREEN";
    if (violationCount >= 5) status = "RED";
    else if (violationCount >= 3) status = "YELLOW";
    
    const existingIndex = this.englishPerformanceHistory.findIndex(
        h => h.semester === semester && h.academicYear === academicYear
    );
    
    if (existingIndex >= 0) {
        this.englishPerformanceHistory[existingIndex].violationCount = violationCount;
        this.englishPerformanceHistory[existingIndex].status = status;
    } else {
        this.englishPerformanceHistory.push({
            semester,
            academicYear,
            violationCount,
            status
        });
    }
    
    return { violationCount, status };
};

// Get conduct status
studentSchema.methods.getConductStatus = function() {
    if (this.currentConductScore >= 36) return "EXCELLENT";
    if (this.currentConductScore >= 30) return "GOOD";
    if (this.currentConductScore >= 20) return "AVERAGE";
    return "POOR";
};

// Get English performance status
studentSchema.methods.getEnglishStatus = function() {
    if (this.englishViolationCount === 0) return "GREEN";
    if (this.englishViolationCount <= 2) return "YELLOW";
    return "RED";
};

// Calculate attendance rate
studentSchema.methods.calculateAttendanceRate = function() {
    if (this.attendanceSummary.totalDays === 0) return 0;
    const rate = ((this.attendanceSummary.presentDays + this.attendanceSummary.lateDays) / this.attendanceSummary.totalDays) * 100;
    this.attendanceSummary.attendanceRate = Math.round(rate * 10) / 10;
    return this.attendanceSummary.attendanceRate;
};

// ========== STATIC METHODS ==========

// Get students by class
studentSchema.statics.getStudentsByClass = function(grade, className, schoolId) {
    return this.find({ grade, className, school: schoolId, status: "ACTIVE", isDeleted: false })
        .sort({ name: 1 });
};

// Get class performance summary
studentSchema.statics.getClassPerformanceSummary = async function(grade, className, schoolId) {
    const students = await this.find({ grade, className, school: schoolId, status: "ACTIVE", isDeleted: false });
    
    if (students.length === 0) return null;
    
    const totalStudents = students.length;
    let totalConductScore = 0;
    let totalEnglishViolations = 0;
    let excellentConduct = 0, goodConduct = 0, averageConduct = 0, poorConduct = 0;
    let greenEnglish = 0, yellowEnglish = 0, redEnglish = 0;
    
    students.forEach(s => {
        totalConductScore += s.currentConductScore;
        totalEnglishViolations += s.englishViolationCount;
        
        const conductStatus = s.getConductStatus();
        if (conductStatus === "EXCELLENT") excellentConduct++;
        else if (conductStatus === "GOOD") goodConduct++;
        else if (conductStatus === "AVERAGE") averageConduct++;
        else poorConduct++;
        
        const englishStatus = s.getEnglishStatus();
        if (englishStatus === "GREEN") greenEnglish++;
        else if (englishStatus === "YELLOW") yellowEnglish++;
        else redEnglish++;
    });
    
    return {
        grade,
        className,
        totalStudents,
        averageConductScore: (totalConductScore / totalStudents).toFixed(1),
        averageEnglishViolations: (totalEnglishViolations / totalStudents).toFixed(1),
        conductDistribution: { excellentConduct, goodConduct, averageConduct, poorConduct },
        englishDistribution: { greenEnglish, yellowEnglish, redEnglish }
    };
};

// Generate student ID helper function
studentSchema.statics.generateStudentId = async function(schoolId) {
    const Student = this;
    const lastStudent = await Student.findOne({ 
        school: schoolId,
        isDeleted: false 
    }).sort({ studentId: -1 }).limit(1);
    
    let lastId = 0;
    if (lastStudent && lastStudent.studentId) {
        const match = lastStudent.studentId.match(/\d+/);
        if (match) lastId = parseInt(match[0]);
    }
    return `STD-${String(lastId + 1).padStart(4, '0')}`;
};

// ========== INDEXES ==========
studentSchema.index({ school: 1, grade: 1, className: 1 });
studentSchema.index({ school: 1, studentId: 1 });
studentSchema.index({ school: 1, status: 1 });
studentSchema.index({ school: 1, currentConductScore: -1 });
studentSchema.index({ school: 1, englishViolationCount: -1 });

module.exports = mongoose.model("Student", studentSchema);