const Visitor = require("../models/Visitor");

// Helper function to check permissions
const hasPermission = (user, allowedTypes) => {
  if (user.role === "superadmin") return true;
  return allowedTypes.includes(user.userType);
};

// Create visitor (check-in)
exports.createVisitor = async (req, res) => {
  try {
    console.log("Creating visitor with data:", req.body);
    
    // Permission check
    if (!hasPermission(req.user, ["customer_care", "school_admin"])) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Only Customer Care and Admin can check in visitors." 
      });
    }

    // Validation
    if (!req.body.name) {
      return res.status(400).json({ success: false, message: "Visitor name is required" });
    }
    if (!req.body.phone) {
      return res.status(400).json({ success: false, message: "Phone number is required" });
    }
    if (!req.body.reasonForVisit) {
      return res.status(400).json({ success: false, message: "Reason for visit is required" });
    }

    const visitorData = {
      name: req.body.name.trim(),
      phone: req.body.phone.trim(),
      email: req.body.email || "",
      reasonForVisit: req.body.reasonForVisit,
      reasonCategory: req.body.reasonCategory || "OTHER",
      personToMeet: req.body.personToMeet || "",
      notes: req.body.notes || "",
      recordedBy: req.user.id,
      recordedByName: req.user.name,
      school: req.user.schoolId,
      status: "ACTIVE",
      checkInTime: new Date(),
      checkOutTime: null,
      durationMinutes: 0
    };

    const visitor = new Visitor(visitorData);
    const savedVisitor = await visitor.save();

    res.status(201).json({
      success: true,
      message: "Visitor checked in successfully",
      visitor: savedVisitor
    });
  } catch (error) {
    console.error("Create visitor error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Checkout visitor
exports.checkoutVisitor = async (req, res) => {
  try {
    if (!hasPermission(req.user, ["customer_care", "school_admin"])) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Only Customer Care and Admin can checkout visitors." 
      });
    }

    const visitor = await Visitor.findOne({ 
      _id: req.params.id, 
      school: req.user.schoolId,
      status: "ACTIVE"
    });

    if (!visitor) {
      return res.status(404).json({ success: false, message: "Active visitor not found" });
    }

    const checkOutTime = new Date();
    const durationMinutes = Math.round((checkOutTime - visitor.checkInTime) / (1000 * 60));
    
    visitor.checkOutTime = checkOutTime;
    visitor.status = "CHECKED_OUT";
    visitor.durationMinutes = durationMinutes;
    
    await visitor.save();

    res.json({
      success: true,
      message: "Visitor checked out successfully",
      visitor: {
        id: visitor._id,
        name: visitor.name,
        checkInTime: visitor.checkInTime,
        checkOutTime: visitor.checkOutTime,
        durationMinutes: visitor.durationMinutes
      }
    });
  } catch (error) {
    console.error("Checkout visitor error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all visitors
exports.getVisitors = async (req, res) => {
  try {
    if (!hasPermission(req.user, ["customer_care", "school_admin"])) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Only Customer Care and Admin can view visitors." 
      });
    }

    const { startDate, endDate, reasonCategory, search, status } = req.query;
    let filter = { school: req.user.schoolId };

    if (startDate && endDate) {
      filter.checkInTime = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    if (reasonCategory && reasonCategory !== "ALL") {
      filter.reasonCategory = reasonCategory;
    }
    if (status && status !== "ALL") {
      filter.status = status;
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const visitors = await Visitor.find(filter)
      .sort({ checkInTime: -1 })
      .limit(500);

    res.json({
      success: true,
      count: visitors.length,
      visitors
    });
  } catch (error) {
    console.error("Get visitors error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get single visitor
exports.getVisitorById = async (req, res) => {
  try {
    if (!hasPermission(req.user, ["customer_care", "school_admin"])) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied." 
      });
    }

    const visitor = await Visitor.findOne({ 
      _id: req.params.id, 
      school: req.user.schoolId 
    });

    if (!visitor) {
      return res.status(404).json({ success: false, message: "Visitor not found" });
    }

    res.json({ success: true, visitor });
  } catch (error) {
    console.error("Get visitor error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update visitor
exports.updateVisitor = async (req, res) => {
  try {
    if (!hasPermission(req.user, ["customer_care", "school_admin"])) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied." 
      });
    }

    const updateData = {
      name: req.body.name,
      phone: req.body.phone,
      email: req.body.email || "",
      reasonForVisit: req.body.reasonForVisit,
      reasonCategory: req.body.reasonCategory,
      personToMeet: req.body.personToMeet || "",
      notes: req.body.notes || ""
    };
    
    // Remove undefined fields
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    const visitor = await Visitor.findOneAndUpdate(
      { _id: req.params.id, school: req.user.schoolId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!visitor) {
      return res.status(404).json({ success: false, message: "Visitor not found" });
    }

    res.json({ success: true, message: "Visitor updated successfully", visitor });
  } catch (error) {
    console.error("Update visitor error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete visitor (Admin only)
exports.deleteVisitor = async (req, res) => {
  try {
    if (!hasPermission(req.user, ["school_admin"])) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Only Administrators can delete visitor records." 
      });
    }

    const visitor = await Visitor.findOneAndDelete({ 
      _id: req.params.id, 
      school: req.user.schoolId 
    });

    if (!visitor) {
      return res.status(404).json({ success: false, message: "Visitor not found" });
    }

    res.json({ success: true, message: "Visitor deleted successfully" });
  } catch (error) {
    console.error("Delete visitor error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get visitor statistics (Admin only)
exports.getVisitorStatistics = async (req, res) => {
  try {
    if (!hasPermission(req.user, ["school_admin"])) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Only Administrators can view statistics." 
      });
    }

    const totalVisitors = await Visitor.countDocuments({ school: req.user.schoolId });
    const activeVisitors = await Visitor.countDocuments({ school: req.user.schoolId, status: "ACTIVE" });
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayVisitors = await Visitor.countDocuments({
      school: req.user.schoolId,
      checkInTime: { $gte: todayStart }
    });

    const byReason = await Visitor.aggregate([
      { $match: { school: req.user.schoolId } },
      { $group: { _id: "$reasonCategory", count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      statistics: {
        totalVisitors,
        activeVisitors,
        todayVisitors,
        byReason: byReason.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error("Get visitor statistics error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get visitor report (Admin only)
exports.getVisitorReport = async (req, res) => {
  try {
    if (!hasPermission(req.user, ["school_admin"])) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Only Administrators can view reports." 
      });
    }

    const { startDate, endDate } = req.query;
    let filter = { school: req.user.schoolId };

    if (startDate && endDate) {
      filter.checkInTime = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const visitors = await Visitor.find(filter).sort({ checkInTime: -1 });

    const totalVisitors = visitors.length;
    const completedVisits = visitors.filter(v => v.status === "CHECKED_OUT").length;
    const activeVisits = visitors.filter(v => v.status === "ACTIVE").length;

    res.json({
      success: true,
      report: {
        summary: { totalVisitors, completedVisits, activeVisits },
        visitors: visitors.slice(0, 100)
      }
    });
  } catch (error) {
    console.error("Get visitor report error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};