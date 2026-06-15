const express = require("express");
const router = express.Router();
const disciplineController = require("../controllers/disciplineController");
const authMiddleware = require("../middleware/authMiddleware");

// Apply auth middleware to all routes
router.use(authMiddleware);

// Teacher and School Admin can add offenses
router.post("/offense", disciplineController.addOffense);

// Get student discipline - Teachers can view their students, Admins can view all
router.get("/student/:studentId", disciplineController.getStudentDiscipline);

// Class summary - School Admin only (teachers should not access)
router.get("/class-summary", disciplineController.getClassDisciplineSummary);

// Conduct report - School Admin only
router.get("/conduct-report", disciplineController.getConductReport);

module.exports = router;