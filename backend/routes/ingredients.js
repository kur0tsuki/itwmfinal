const express = require("express");
const router = express.Router();
const Ingredient = require("../models/Ingredient");
const mongoose = require("mongoose");

// GET /api/ingredients
router.get("/", async (req, res, next) => {
  try {
    const ingredients = await Ingredient.find().sort({ name: 1 });
    res.json(ingredients);
  } catch (error) {
    next(error);
  }
});

// POST /api/ingredients
router.post("/", async (req, res, next) => {
  try {
    const { name, quantity, unit, minThreshold, costPerUnit } = req.body;

    const ingredient = new Ingredient({
      name,
      quantity: parseFloat(quantity),
      unit,
      minThreshold: parseFloat(minThreshold),
      costPerUnit: parseFloat(costPerUnit),
    });

    await ingredient.save();
    res.status(201).json(ingredient);
  } catch (error) {
    console.error("Create ingredient error:", error);
    next(error);
  }
});

// PUT /api/ingredients/:id
router.put("/:id", async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid ingredient ID format" });
    }

    const { name, quantity, unit, minThreshold, costPerUnit } = req.body;

    const ingredient = await Ingredient.findByIdAndUpdate(
      req.params.id,
      {
        name,
        quantity: parseFloat(quantity),
        unit,
        minThreshold: parseFloat(minThreshold),
        costPerUnit: parseFloat(costPerUnit),
      },
      { new: true, runValidators: true }
    );

    if (!ingredient) {
      return res.status(404).json({ error: "Ingredient not found" });
    }

    res.json(ingredient);
  } catch (error) {
    console.error("Update ingredient error:", error);
    next(error);
  }
});

// DELETE /api/ingredients/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const ingredient = await Ingredient.findByIdAndDelete(req.params.id);
    if (!ingredient) {
      return res.status(404).json({ error: "Ingredient not found" });
    }
    res.json({ message: "Ingredient deleted successfully" });
  } catch (error) {
    next(error);
  }
});

// POST /api/ingredients/:id/restock
router.post("/:id/restock", async (req, res, next) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res
        .status(400)
        .json({ error: "Amount must be greater than zero" });
    }

    const ingredient = await Ingredient.findById(req.params.id);
    if (!ingredient) {
      return res.status(404).json({ error: "Ingredient not found" });
    }

    ingredient.quantity += parseFloat(amount);
    await ingredient.save();

    res.json(ingredient);
  } catch (error) {
    next(error);
  }
});

// GET /api/ingredients/:id
router.get("/:id", async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid ingredient ID format" });
    }

    const ingredient = await Ingredient.findById(req.params.id);

    if (!ingredient) {
      return res.status(404).json({ error: "Ingredient not found" });
    }

    console.log("Sending ingredient data:", ingredient); // Debug log

    res.json({
      _id: ingredient._id,
      name: ingredient.name,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      minThreshold: ingredient.minThreshold,
      costPerUnit: ingredient.costPerUnit,
      createdAt: ingredient.createdAt,
      updatedAt: ingredient.updatedAt,
    });
  } catch (error) {
    console.error("Get ingredient error:", error);
    next(error);
  }
});

module.exports = router;
