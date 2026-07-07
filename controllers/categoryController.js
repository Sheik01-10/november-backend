const Category = require("../models/Category");

// Get all categories
exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Create category
exports.createCategory = async (req, res) => {
  try {
    const category = new Category(req.body);
    const newCategory = await category.save();

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      io.emit("category_changed", { action: "create", data: newCategory });
    }

    res.status(201).json(newCategory);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Update category
exports.updateCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: "Category not found" });

    Object.assign(category, req.body);
    const updatedCategory = await category.save();

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      io.emit("category_changed", { action: "update", data: updatedCategory });
    }

    res.json(updatedCategory);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Delete category
exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: "Category not found" });

    await category.deleteOne();

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      io.emit("category_changed", { action: "delete", data: { _id: req.params.id } });
    }

    res.json({ message: "Category deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
