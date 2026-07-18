const mongoose = require("mongoose");

// Helper function to generate school code
function generateSchoolCode(name) {
    const cleanName = name.replace(/[^a-zA-Z]/g, '');
    let namePart = cleanName.substring(0, 3).toUpperCase();
    if (namePart.length < 3) {
        namePart = namePart.padEnd(3, 'X');
    }
    const randomNum = Math.floor(Math.random() * 9000 + 1000);
    return `${namePart}${randomNum}`;
}

const schoolSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    schoolCode: {
        type: String,
        unique: true,
        uppercase: true,
        trim: true,
        default: function() {
            return generateSchoolCode(this.name);
        }
    },
    email: { type: String, required: true, lowercase: true },
    phone: { type: String, default: "" },
    address: { type: String, default: "" },
    logo: { type: String, default: "" },
    status: {
        type: String,
        enum: ["pending", "active", "suspended", "rejected"],
        default: "pending"
    },
    registeredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    rejectionReason: { type: String, default: "" },
    settings: {
        allowBorrowing: { type: Boolean, default: true },
        allowStockAlerts: { type: Boolean, default: true },
        maxUsers: { type: Number, default: 10 },
        currency: { type: String, default: "RWF" },
    },
    // Controls which optional sidebar/menu features are visible for this school.
    // All default to true so existing schools are unaffected until a super admin
    // explicitly hides something for them.
    layoutFeatures: {
        fees: { type: Boolean, default: true },
        transport: { type: Boolean, default: true },
        library: { type: Boolean, default: true },
        laboratory: { type: Boolean, default: true },
        discipline: { type: Boolean, default: true },
        englishPerformance: { type: Boolean, default: true },
        slowLearners: { type: Boolean, default: true },
        visitors: { type: Boolean, default: true },
        homework: { type: Boolean, default: true },
        activities: { type: Boolean, default: true },
        assets: { type: Boolean, default: true },
        trackedAssets: { type: Boolean, default: true },
        cleaningSupplies: { type: Boolean, default: true },
        feeding: { type: Boolean, default: true },
        borrowed: { type: Boolean, default: true },
    },
    createdAt: { type: Date, default: Date.now }
});

// NO pre-save hook - using default function instead

module.exports = mongoose.model("School", schoolSchema);