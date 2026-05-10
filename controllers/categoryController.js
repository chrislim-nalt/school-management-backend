const Category = require("../models/Category");

// Get all categories (filtered by school - super admin sees all)
exports.getCategories = async (req, res) => {
  try {
    let filter = {};
    
    // If user is super admin, show all categories (no school filter)
    if (req.user.role !== "superadmin") {
      // For school users, only show their school's categories
      if (!req.user.schoolId) {
        return res.status(400).json({ message: "School not found. Please login again." });
      }
      filter.school = req.user.schoolId;
    }
    
    const categories = await Category.find(filter)
      .populate('school', 'name code')
      .sort({ displayOrder: 1, createdAt: -1 });
    
    res.json(categories);
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get single category by ID
exports.getCategoryById = async (req, res) => {
  try {
    let filter = { _id: req.params.id };
    
    // If user is not super admin, filter by school
    if (req.user.role !== "superadmin") {
      if (!req.user.schoolId) {
        return res.status(400).json({ message: "School not found. Please login again." });
      }
      filter.school = req.user.schoolId;
    }
    
    const category = await Category.findOne(filter).populate('school', 'name code');
    
    if (!category) {
      return res.status(404).json({ message: "Category not found or access denied" });
    }
    res.json(category);
  } catch (error) {
    console.error("Get category by ID error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Create category
exports.createCategory = async (req, res) => {
  try {
    const { name, description, categoryType, icon, displayOrder } = req.body;
    
    // Super admin cannot create categories (they must belong to schools)
    if (req.user.role === "superadmin") {
      return res.status(403).json({ 
        message: "Super Admin cannot create categories. Categories must be associated with a specific school. Please login as a School Admin to create categories." 
      });
    }
    
    // Check if schoolId exists for non-superadmin users
    if (!req.user.schoolId) {
      return res.status(400).json({ 
        message: "School information missing. Please login again or contact support." 
      });
    }
    
    // Validate required fields
    if (!name || name.trim() === "") {
      return res.status(400).json({ message: "Category name is required" });
    }
    
    // Check for existing category with same name in the same school
    const existingCategory = await Category.findOne({ 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }, 
      school: req.user.schoolId 
    });
    
    if (existingCategory) {
      return res.status(400).json({ 
        message: `Category "${name}" already exists in your school. Please use a different name.` 
      });
    }
    
    // Create new category
    const category = new Category({
      name: name.trim(),
      description: description || "",
      categoryType: categoryType || "OTHER",
      icon: icon || "📦",
      displayOrder: displayOrder || 0,
      school: req.user.schoolId  // Explicitly set school ID
    });
    
    await category.save();
    
    // Return populated category
    const populatedCategory = await Category.findById(category._id).populate('school', 'name code');
    
    res.status(201).json({ 
      success: true,
      message: "Category created successfully",
      category: populatedCategory 
    });
  } catch (error) {
    console.error("Create category error:", error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: "Category with this name already exists in your school" 
      });
    }
    
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update category
exports.updateCategory = async (req, res) => {
  try {
    const { name, description, categoryType, icon, displayOrder, isActive } = req.body;
    
    let filter = { _id: req.params.id };
    
    // If user is not super admin, filter by school
    if (req.user.role !== "superadmin") {
      if (!req.user.schoolId) {
        return res.status(400).json({ message: "School not found. Please login again." });
      }
      filter.school = req.user.schoolId;
    }
    
    // Find the category first to check ownership
    const existingCategory = await Category.findOne(filter);
    if (!existingCategory) {
      return res.status(404).json({ message: "Category not found or access denied" });
    }
    
    // If name is being changed, check for duplicates
    if (name && name !== existingCategory.name) {
      const duplicateCheck = await Category.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
        school: existingCategory.school,
        _id: { $ne: req.params.id }
      });
      
      if (duplicateCheck) {
        return res.status(400).json({ 
          message: `Category "${name}" already exists in your school` 
        });
      }
    }
    
    // Prepare update data
    const updateData = {};
    if (name) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description;
    if (categoryType) updateData.categoryType = categoryType;
    if (icon) updateData.icon = icon;
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    // Update category
    const updatedCategory = await Category.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('school', 'name code');
    
    res.json({ 
      success: true,
      message: "Category updated successfully",
      category: updatedCategory 
    });
  } catch (error) {
    console.error("Update category error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Delete category
exports.deleteCategory = async (req, res) => {
  try {
    let filter = { _id: req.params.id };
    
    // If user is not super admin, filter by school
    if (req.user.role !== "superadmin") {
      if (!req.user.schoolId) {
        return res.status(400).json({ message: "School not found. Please login again." });
      }
      filter.school = req.user.schoolId;
    }
    
    const category = await Category.findOneAndDelete(filter);
    if (!category) {
      return res.status(404).json({ message: "Category not found or access denied" });
    }
    
    res.json({ 
      success: true,
      message: `Category "${category.name}" deleted successfully` 
    });
  } catch (error) {
    console.error("Delete category error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Bulk delete categories (admin only)
exports.bulkDeleteCategories = async (req, res) => {
  try {
    const { categoryIds } = req.body;
    
    if (!categoryIds || !Array.isArray(categoryIds) || categoryIds.length === 0) {
      return res.status(400).json({ message: "Please provide category IDs to delete" });
    }
    
    let filter = { _id: { $in: categoryIds } };
    
    // If user is not super admin, filter by school
    if (req.user.role !== "superadmin") {
      if (!req.user.schoolId) {
        return res.status(400).json({ message: "School not found. Please login again." });
      }
      filter.school = req.user.schoolId;
    }
    
    const result = await Category.deleteMany(filter);
    
    res.json({ 
      success: true,
      message: `${result.deletedCount} categories deleted successfully`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error("Bulk delete categories error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Toggle category status (activate/deactivate)
exports.toggleCategoryStatus = async (req, res) => {
  try {
    let filter = { _id: req.params.id };
    
    // If user is not super admin, filter by school
    if (req.user.role !== "superadmin") {
      if (!req.user.schoolId) {
        return res.status(400).json({ message: "School not found. Please login again." });
      }
      filter.school = req.user.schoolId;
    }
    
    const category = await Category.findOne(filter);
    if (!category) {
      return res.status(404).json({ message: "Category not found or access denied" });
    }
    
    category.isActive = !category.isActive;
    await category.save();
    
    res.json({ 
      success: true,
      message: `Category ${category.isActive ? 'activated' : 'deactivated'} successfully`,
      category 
    });
  } catch (error) {
    console.error("Toggle category status error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};