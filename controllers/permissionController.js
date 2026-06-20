const Permission = require("../models/Permission");
const Teacher = require("../models/Teacher");

// Request permission (Teacher only)
exports.requestPermission = async (req, res) => {
  try {
    console.log("=== REQUEST PERMISSION ===");
    console.log("Request body:", req.body);
    console.log("User:", req.user);

    const { reason, startDate, endDate } = req.body;

    // Validate inputs
    if (!reason || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid date format" });
    }

    if (start > end) {
      return res.status(400).json({ success: false, message: "Start date must be before end date" });
    }

    const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays > 7) {
      return res.status(400).json({ success: false, message: "Permission cannot exceed 7 days" });
    }

    // Find teacher by email
    let teacher = await Teacher.findOne({
      email: req.user.email,
      school: req.user.schoolId
    });

    // If teacher not found, check if user has teacher role
    if (!teacher && req.user.userType === "teacher") {
      // Create teacher record if it doesn't exist
      const TeacherModel = require("../models/Teacher");
      const teacherId = await TeacherModel.generateTeacherId(req.user.schoolId);
      teacher = new TeacherModel({
        teacherId: teacherId,
        name: req.user.name,
        email: req.user.email,
        school: req.user.schoolId,
        status: "ACTIVE"
      });
      await teacher.save();
      console.log("Created teacher record for:", req.user.email);
    }

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: `Teacher record not found for email: ${req.user.email}. Please contact your administrator.`
      });
    }

    // Check for existing pending permission
    const existing = await Permission.findOne({
      teacher: teacher._id,
      status: "PENDING",
      school: req.user.schoolId
    });
    if (existing) {
      return res.status(400).json({ success: false, message: "You already have a pending permission request" });
    }

    const permission = new Permission({
      teacher: teacher._id,
      teacherName: teacher.name || req.user.name,
      teacherEmail: teacher.email || req.user.email,
      reason,
      startDate: start,
      endDate: end,
      school: req.user.schoolId
    });

    await permission.save();
    console.log("Permission saved:", permission._id);

    res.status(201).json({
      success: true,
      message: "Permission request submitted successfully",
      permission
    });
  } catch (error) {
    console.error("Request permission error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get my permissions (Teacher)
exports.getMyPermissions = async (req, res) => {
  try {
    console.log("=== GET MY PERMISSIONS ===");
    console.log("User:", req.user.email, req.user.userType);

    // Find teacher by email or use user id
    let teacher = await Teacher.findOne({
      email: req.user.email,
      school: req.user.schoolId
    });

    // If teacher not found, try to find by user id
    if (!teacher) {
      teacher = await Teacher.findOne({
        _id: req.user.id,
        school: req.user.schoolId
      });
    }

    if (!teacher) {
      // Return empty list with success - teacher may not have requested any permissions yet
      return res.json({ 
        success: true, 
        permissions: [],
        message: "No permissions found. You can create a new permission request."
      });
    }

    const permissions = await Permission.find({
      teacher: teacher._id,
      school: req.user.schoolId
    }).sort({ createdAt: -1 });

    console.log(`Found ${permissions.length} permissions for ${teacher.name}`);
    res.json({ success: true, permissions });
  } catch (error) {
    console.error("Get my permissions error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all permissions (School Admin)
exports.getAllPermissions = async (req, res) => {
  try {
    const { status, startDate, endDate, teacherId } = req.query;
    let filter = { school: req.user.schoolId };

    if (status) filter.status = status;
    if (teacherId) filter.teacher = teacherId;
    if (startDate && endDate) {
      filter.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const permissions = await Permission.find(filter)
      .populate("teacher", "name email teacherId")
      .populate("approvedBy", "name email")
      .sort({ createdAt: -1 });

    // Calculate summary
    const summary = {
      total: permissions.length,
      pending: permissions.filter(p => p.status === "PENDING").length,
      approved: permissions.filter(p => p.status === "APPROVED").length,
      disapproved: permissions.filter(p => p.status === "DISAPPROVED").length,
      revoked: permissions.filter(p => p.status === "REVOKED").length
    };

    res.json({ success: true, permissions, summary });
  } catch (error) {
    console.error("Get all permissions error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Approve permission
exports.approvePermission = async (req, res) => {
  try {
    const { id } = req.params;
    
    const permission = await Permission.findOne({ _id: id, school: req.user.schoolId });
    if (!permission) {
      return res.status(404).json({ success: false, message: "Permission not found" });
    }
    
    if (permission.status !== "PENDING") {
      return res.status(400).json({ success: false, message: `Permission is already ${permission.status}` });
    }
    
    permission.status = "APPROVED";
    permission.approvedBy = req.user.id;
    permission.approvedByName = req.user.name;
    permission.approvedAt = new Date();
    
    await permission.save();
    
    res.json({
      success: true,
      message: "Permission approved successfully",
      permission
    });
  } catch (error) {
    console.error("Approve permission error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Disapprove permission
exports.disapprovePermission = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    
    const permission = await Permission.findOne({ _id: id, school: req.user.schoolId });
    if (!permission) {
      return res.status(404).json({ success: false, message: "Permission not found" });
    }
    
    if (permission.status !== "PENDING") {
      return res.status(400).json({ success: false, message: `Permission is already ${permission.status}` });
    }
    
    permission.status = "DISAPPROVED";
    permission.rejectionReason = rejectionReason || "No reason provided";
    permission.approvedBy = req.user.id;
    permission.approvedByName = req.user.name;
    permission.approvedAt = new Date();
    
    await permission.save();
    
    res.json({
      success: true,
      message: "Permission disapproved",
      permission
    });
  } catch (error) {
    console.error("Disapprove permission error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Revoke permission
exports.revokePermission = async (req, res) => {
  try {
    const { id } = req.params;
    
    const permission = await Permission.findOne({ _id: id, school: req.user.schoolId });
    if (!permission) {
      return res.status(404).json({ success: false, message: "Permission not found" });
    }
    
    if (permission.status !== "APPROVED") {
      return res.status(400).json({ success: false, message: "Only approved permissions can be revoked" });
    }
    
    permission.status = "REVOKED";
    await permission.save();
    
    res.json({
      success: true,
      message: "Permission revoked successfully"
    });
  } catch (error) {
    console.error("Revoke permission error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get permission report
exports.getPermissionReport = async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    let filter = { school: req.user.schoolId };

    if (startDate && endDate) {
      filter.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    if (status) filter.status = status;

    const permissions = await Permission.find(filter)
      .populate("teacher", "name email teacherId")
      .sort({ createdAt: -1 });

    // Build byTeacher
    const byTeacher = {};
    permissions.forEach(p => {
      const name = p.teacherName || "Unknown";
      if (!byTeacher[name]) {
        byTeacher[name] = {
          total: 0,
          approved: 0,
          pending: 0,
          disapproved: 0,
          revoked: 0,
          totalDays: 0
        };
      }
      byTeacher[name].total++;
      const statusKey = p.status.toLowerCase();
      if (byTeacher[name][statusKey] !== undefined) {
        byTeacher[name][statusKey]++;
      }
      byTeacher[name].totalDays += p.totalDays || 0;
    });

    // Build byMonth
    const byMonth = {};
    permissions.forEach(p => {
      const month = p.createdAt.toISOString().substring(0, 7);
      if (!byMonth[month]) {
        byMonth[month] = {
          total: 0,
          approved: 0,
          pending: 0,
          disapproved: 0,
          revoked: 0
        };
      }
      byMonth[month].total++;
      const statusKey = p.status.toLowerCase();
      if (byMonth[month][statusKey] !== undefined) {
        byMonth[month][statusKey]++;
      }
    });

    const totalDaysRequested = permissions.reduce((sum, p) => sum + (p.totalDays || 0), 0);

    // Format data for charts
    const chartData = {
      statusDistribution: [
        { label: "Approved", value: permissions.filter(p => p.status === "APPROVED").length },
        { label: "Pending", value: permissions.filter(p => p.status === "PENDING").length },
        { label: "Disapproved", value: permissions.filter(p => p.status === "DISAPPROVED").length },
        { label: "Revoked", value: permissions.filter(p => p.status === "REVOKED").length }
      ],
      monthlyTrend: Object.entries(byMonth).map(([month, data]) => ({
        month,
        ...data
      })).sort((a, b) => a.month.localeCompare(b.month))
    };

    res.json({
      success: true,
      summary: {
        totalRequests: permissions.length,
        approvedCount: permissions.filter(p => p.status === "APPROVED").length,
        pendingCount: permissions.filter(p => p.status === "PENDING").length,
        disapprovedCount: permissions.filter(p => p.status === "DISAPPROVED").length,
        revokedCount: permissions.filter(p => p.status === "REVOKED").length,
        totalDaysRequested,
        averageDaysPerRequest: permissions.length > 0
          ? (totalDaysRequested / permissions.length).toFixed(1)
          : 0
      },
      byTeacher,
      byMonth,
      chartData,
      permissions
    });
  } catch (error) {
    console.error("Get permission report error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};