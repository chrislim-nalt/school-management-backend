const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { authorize } = require("../middleware/authMiddleware");
const stockController = require("../controllers/stockController");

// Apply auth middleware to all routes
router.use(authMiddleware);

// Stock routes - Only stock keepers and admins can access
router.get("/borrowed", authorize("superadmin", "school_admin", "stock_keeper", "bursar"), stockController.getBorrowedItems);
router.get("/", authorize("superadmin", "school_admin", "stock_keeper", "bursar"), stockController.getTransactions);
router.post("/", authorize("superadmin", "school_admin", "stock_keeper", "bursar"), stockController.createTransaction);
router.get("/item/:itemId", authorize("superadmin", "school_admin", "stock_keeper", "bursar"), stockController.getItemTransactions);
router.put("/:id/return", authorize("superadmin", "school_admin", "stock_keeper","bursar"), stockController.returnBorrowedItem);
router.put("/:id", authorize("superadmin", "school_admin", "stock_keeper","bursar"), stockController.updateTransaction);
router.delete("/:id", authorize("superadmin", "school_admin", "stock_keeper","bursar"), stockController.deleteTransaction);

module.exports = router;