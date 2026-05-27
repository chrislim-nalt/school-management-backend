const StockTransaction = require("../models/StockTransaction");
const Item = require("../models/Item");

// Get all transactions
exports.getTransactions = async (req, res) => {
  try {
    const transactions = await StockTransaction.find({ school: req.user.schoolId })
      .populate({
        path: "item",
        populate: { path: "category" }
      })
      .sort({ createdAt: -1 });
    res.json(transactions);
  } catch (error) {
    console.error("Get transactions error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Create transaction
exports.createTransaction = async (req, res) => {
  try {
    const { item, type, quantity, date, reference, purpose, borrowerName, expectedReturnDate } = req.body;

    const foundItem = await Item.findOne({ _id: item, school: req.user.schoolId });
    if (!foundItem) {
      return res.status(404).json({ message: "Item not found" });
    }

    if ((type === "OUT" || type === "BORROW") && foundItem.currentQuantity < quantity) {
      return res.status(400).json({ message: `Insufficient stock! Available: ${foundItem.currentQuantity}` });
    }

    const transactionData = {
      item,
      type,
      quantity,
      date: date || new Date(),
      reference: reference || "",
      purpose: purpose || "",
      performedBy: req.user.name || "System",
      school: req.user.schoolId
    };

    if (type === "BORROW") {
      transactionData.borrowerName = borrowerName || "Unknown";
      transactionData.borrowerDepartment = req.body.borrowerDepartment || "Classroom";
      transactionData.expectedReturnDate = expectedReturnDate || new Date(Date.now() + 7 * 86400000);
      transactionData.status = "BORROWED";
    }

    const transaction = new StockTransaction(transactionData);
    await transaction.save();

    if (type === "IN") {
      foundItem.currentQuantity += quantity;
    } else if (type === "OUT" || type === "BORROW") {
      foundItem.currentQuantity -= quantity;
    }
    await foundItem.save();

    const populatedTransaction = await StockTransaction.findById(transaction._id)
      .populate({
        path: "item",
        populate: { path: "category" }
      });

    res.status(201).json(populatedTransaction);
  } catch (error) {
    console.error("Create transaction error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get item transactions
exports.getItemTransactions = async (req, res) => {
  try {
    const transactions = await StockTransaction.find({ 
      item: req.params.itemId,
      school: req.user.schoolId
    }).populate({
      path: "item",
      populate: { path: "category" }
    });
    res.json(transactions);
  } catch (error) {
    console.error("Get item transactions error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Update transaction
exports.updateTransaction = async (req, res) => {
  try {
    const { quantity, type, date, reference, purpose, borrowerName, expectedReturnDate } = req.body;
    
    const existingTransaction = await StockTransaction.findOne({ 
      _id: req.params.id, 
      school: req.user.schoolId 
    });
    
    if (!existingTransaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }
    
    const item = await Item.findOne({ 
      _id: existingTransaction.item, 
      school: req.user.schoolId 
    });
    
    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }
    
    // Reverse old effect
    if (existingTransaction.type === "IN") {
      item.currentQuantity -= existingTransaction.quantity;
    } else if (existingTransaction.type === "OUT" || existingTransaction.type === "BORROW") {
      item.currentQuantity += existingTransaction.quantity;
    }
    
    // Apply new effect
    if (type === "IN") {
      item.currentQuantity += quantity;
    } else if (type === "OUT" || type === "BORROW") {
      if (item.currentQuantity < quantity) {
        return res.status(400).json({ message: "Insufficient stock" });
      }
      item.currentQuantity -= quantity;
    }
    await item.save();
    
    const updateData = { quantity, type, date, reference, purpose };
    if (type === "BORROW") {
      updateData.borrowerName = borrowerName;
      updateData.expectedReturnDate = expectedReturnDate;
    }
    
    const updatedTransaction = await StockTransaction.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate({
      path: "item",
      populate: { path: "category" }
    });
    
    res.json(updatedTransaction);
  } catch (error) {
    console.error("Update transaction error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Delete transaction
exports.deleteTransaction = async (req, res) => {
  try {
    const transaction = await StockTransaction.findOneAndDelete({ 
      _id: req.params.id, 
      school: req.user.schoolId 
    });
    
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }
    
    const item = await Item.findOne({ 
      _id: transaction.item, 
      school: req.user.schoolId 
    });
    
    if (item) {
      if (transaction.type === "IN") {
        item.currentQuantity -= transaction.quantity;
      } else if (transaction.type === "OUT" || transaction.type === "BORROW") {
        item.currentQuantity += transaction.quantity;
      }
      await item.save();
    }
    
    res.json({ message: "Transaction deleted successfully" });
  } catch (error) {
    console.error("Delete transaction error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Return borrowed item
exports.returnBorrowedItem = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("Returning item with ID:", id);
    
    const transaction = await StockTransaction.findOne({ 
      _id: id, 
      school: req.user.schoolId 
    });
    
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }
    
    if (transaction.type !== "BORROW") {
      return res.status(400).json({ message: "This transaction is not a borrow record" });
    }
    
    if (transaction.status === "RETURNED") {
      return res.status(400).json({ message: "Item already returned" });
    }
    
    transaction.status = "RETURNED";
    transaction.actualReturnDate = new Date();
    await transaction.save();
    
    const item = await Item.findOne({ 
      _id: transaction.item, 
      school: req.user.schoolId 
    });
    if (item) {
      item.currentQuantity += transaction.quantity;
      await item.save();
      console.log(`Added ${transaction.quantity} back to ${item.name} stock. New quantity: ${item.currentQuantity}`);
    }
    
    await StockTransaction.create({
      item: transaction.item,
      type: "RETURN",
      quantity: transaction.quantity,
      date: new Date(),
      reference: `RETURN_OF_${transaction._id}`,
      purpose: `Return of borrowed items by ${transaction.borrowerName}`,
      performedBy: req.user.name || "System",
      school: req.user.schoolId
    });
    
    console.log("Item returned successfully");
    res.json({ 
      message: "Item returned successfully",
      transaction: {
        id: transaction._id,
        status: transaction.status,
        actualReturnDate: transaction.actualReturnDate
      }
    });
  } catch (error) {
    console.error("Return error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get borrowed items
exports.getBorrowedItems = async (req, res) => {
  try {
    console.log("Fetching borrowed items for school:", req.user?.schoolId);
    
    const borrowed = await StockTransaction.find({ 
      type: "BORROW",
      status: "BORROWED",
      school: req.user.schoolId
    }).populate({
      path: "item",
      populate: { path: "category" }
    });
    
    console.log(`Found ${borrowed.length} borrowed items`);
    
    const today = new Date();
    const result = borrowed.map(b => ({
      ...b.toObject(),
      isOverdue: b.expectedReturnDate && new Date(b.expectedReturnDate) < today
    }));
    
    res.json(result);
  } catch (error) {
    console.error("Get borrowed error:", error);
    res.status(500).json({ message: error.message });
  }
};