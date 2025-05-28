const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Recipe = require("../models/Recipe");
const Ingredient = require("../models/Ingredient");
const ProductionRecord = require("../models/ProductionRecord");

// GET /api/recipes
router.get("/", async (req, res, next) => {
  try {
    const recipes = await Recipe.find()
      .populate("ingredients.ingredient")
      .sort({ name: 1 });

    // Add computed properties
    for (let recipe of recipes) {
      recipe._doc.canMake = await recipe.canMake();
      recipe._doc.maxPortions = await recipe.maxPortions();
      recipe._doc.cost = await recipe.calculateCost();
    }

    res.json(recipes);
  } catch (error) {
    next(error);
  }
});

// POST /api/recipes
router.post("/", async (req, res, next) => {
  try {
    const recipe = new Recipe(req.body);
    await recipe.save();
    await recipe.populate("ingredients.ingredient");
    res.status(201).json(recipe);
  } catch (error) {
    next(error);
  }
});

// PUT /api/recipes/:id
router.put("/:id", async (req, res, next) => {
  try {
    const recipe = await Recipe.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!recipe) {
      return res.status(404).json({ error: "Recipe not found" });
    }
    await recipe.populate("ingredients.ingredient");
    res.json(recipe);
  } catch (error) {
    next(error);
  }
});

// POST /api/recipes/:id/prepare
router.post("/:id/prepare", async (req, res, next) => {
  try {
    const { quantity = 1 } = req.body;

    // Validate MongoDB ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid recipe ID" });
    }

    if (quantity <= 0) {
      return res
        .status(400)
        .json({ error: "Quantity must be greater than zero" });
    }

    const recipe = await Recipe.findById(req.params.id).populate(
      "ingredients.ingredient"
    );

    if (!recipe) {
      return res.status(404).json({ error: "Recipe not found" });
    }

    const maxPossible = await recipe.maxPortions();
    if (quantity > maxPossible) {
      return res.status(400).json({
        error: `Cannot make ${quantity} ${
          recipe.name
        }(s). Maximum available: ${maxPossible.toFixed(2)}`,
      });
    }

    try {
      // Update ingredient quantities
      for (const ri of recipe.ingredients) {
        const totalNeeded = ri.quantity * quantity;
        const ingredient = await Ingredient.findById(ri.ingredient._id);

        if (!ingredient) {
          throw new Error(`Ingredient ${ri.ingredient._id} not found`);
        }

        ingredient.quantity -= totalNeeded;
        await ingredient.save();
      }

      // Create production record
      const production = new ProductionRecord({
        recipe: recipe._id,
        quantity: parseFloat(quantity),
      });
      await production.save();

      res.json({
        message: `Successfully prepared ${quantity} ${recipe.name}(s)`,
        production,
      });
    } catch (error) {
      // If something fails, throw the error to be caught by the outer catch block
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

// GET /api/recipes/:id
router.get("/:id", async (req, res, next) => {
  try {
    const recipe = await Recipe.findById(req.params.id).populate(
      "ingredients.ingredient"
    );

    if (!recipe) {
      return res.status(404).json({ error: "Recipe not found" });
    }

    // Add computed properties
    recipe._doc.canMake = await recipe.canMake();
    recipe._doc.maxPortions = await recipe.maxPortions();
    recipe._doc.cost = await recipe.calculateCost();

    res.json(recipe);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
