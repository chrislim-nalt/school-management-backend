const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true, 
      trim: true 
    },
    description: { 
      type: String, 
      default: "" 
    },
    categoryType: { 
      type: String, 
      enum: ["CONSUMABLE_FOOD", "CONSUMABLE_NON_FOOD", "EQUIPMENT_OFFICE", "EQUIPMENT_KITCHEN", "EQUIPMENT_LAB", "EQUIPMENT_SPORTS", "EQUIPMENT_TECH", "FURNITURE", "BOOKS", "CHEMICALS", "LIVESTOCK", "FIXED_ASSET", "OTHER"], 
      default: "OTHER" 
    },
    icon: { 
      type: String, 
      default: "📦" 
    },
    displayOrder: { 
      type: Number, 
      default: 0 
    },
    isActive: { 
      type: Boolean, 
      default: true 
    },
    school: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "School",
      // Removed required: true to allow super admin operations
      // Validation will be handled at controller level
    },
  },
  { timestamps: true }
);

// Create compound unique index for name + school (only when school exists)
categorySchema.index(
  { name: 1, school: 1 }, 
  { 
    unique: true, 
    partialFilterExpression: { school: { $exists: true, $ne: null } } 
  }
);

// Virtual field to check if category belongs to a school
categorySchema.virtual('isGlobal').get(function() {
  return !this.school;
});

module.exports = mongoose.model("Category", categorySchema);