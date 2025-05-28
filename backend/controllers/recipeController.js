const Recipe = require("../models/Recipe");
const Ingredient = require("../models/Ingredient");
const ProductionRecord = require("../models/ProductionRecord");
const mongoose = require("mongoose");
const { validationResult } = require("express-validator");

const recipeController = {
  // Get all recipes
  getAllRecipes: async (req, res, next) => {
    try {
      const {
        page = 1,
        limit = 50,
        search = "",
        canMake = false,
        sortBy = "name",
        sortOrder = "asc",
      } = req.query;

      const query = {};

      // Search functionality
      if (search) {
        query.name = { $regex: search, $options: "i" };
      }

      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

      let recipes = await Recipe.find(query)
        .populate("ingredients.ingredient")
        .sort(sortOptions)
        .limit(limit * 1)
        .skip((page - 1) * limit);

      // Add computed properties
      for (let recipe of recipes) {
        recipe._doc.canMake = await recipe.canMake();
        recipe._doc.maxPortions = await recipe.maxPortions();
        recipe._doc.cost = await recipe.calculateCost();
      }

      // Filter by canMake if requested
      if (canMake === "true") {
        recipes = recipes.filter((recipe) => recipe._doc.canMake);
      }

      const total = await Recipe.countDocuments(query);
      const totalPages = Math.ceil(total / limit);

      res.json({
        recipes,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: total,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  // Get recipe by ID
  getRecipeById: async (req, res, next) => {
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
  },

  // Create new recipe
  createRecipe: async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Validate ingredients exist
      if (req.body.ingredients && req.body.ingredients.length > 0) {
        const ingredientIds = req.body.ingredients.map((ing) => ing.ingredient);
        const existingIngredients = await Ingredient.find({
          _id: { $in: ingredientIds },
        });

        if (existingIngredients.length !== ingredientIds.length) {
          return res
            .status(400)
            .json({ error: "One or more ingredients not found" });
        }
      }

      const recipe = new Recipe(req.body);
      await recipe.save();
      await recipe.populate("ingredients.ingredient");

      res.status(201).json(recipe);
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({ error: "Recipe name already exists" });
      }
      next(error);
    }
  },

  // Update recipe
  updateRecipe: async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Validate ingredients exist if provided
      if (req.body.ingredients && req.body.ingredients.length > 0) {
        const ingredientIds = req.body.ingredients.map((ing) => ing.ingredient);
        const existingIngredients = await Ingredient.find({
          _id: { $in: ingredientIds },
        });

        if (existingIngredients.length !== ingredientIds.length) {
          return res
            .status(400)
            .json({ error: "One or more ingredients not found" });
        }
      }

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
      if (error.code === 11000) {
        return res.status(400).json({ error: "Recipe name already exists" });
      }
      next(error);
    }
  },

  // Delete recipe
  deleteRecipe: async (req, res, next) => {
    try {
      const recipe = await Recipe.findByIdAndDelete(req.params.id);

      if (!recipe) {
        return res.status(404).json({ error: "Recipe not found" });
      }

      res.json({ message: "Recipe deleted successfully" });
    } catch (error) {
      next(error);
    }
  },

  // Prepare recipe (production)
  prepareRecipe: async (req, res, next) => {
    try {
      const { quantity = 1 } = req.body;

      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ error: "Invalid recipe ID format" });
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

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Deduct ingredients
        for (let recipeIngredient of recipe.ingredients) {
          const totalNeeded = recipeIngredient.quantity * quantity;
          const ingredient = await Ingredient.findById(
            recipeIngredient.ingredient._id
          );
          ingredient.quantity -= totalNeeded;
          await ingredient.save({ session });
        }

        // Create production record
        const production = new ProductionRecord({
          recipe: recipe._id,
          quantity,
        });
        await production.save({ session });

        await session.commitTransaction();
        res.json({
          message: `Successfully produced ${quantity} ${recipe.name}(s)`,
          production,
        });
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } catch (error) {
      next(error);
    }
  },

  // Get recipe production history
  getRecipeProduction: async (req, res, next) => {
    try {
      const { page = 1, limit = 20 } = req.query;

      const production = await ProductionRecord.find({ recipe: req.params.id })
        .populate("recipe", "name")
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await ProductionRecord.countDocuments({
        recipe: req.params.id,
      });
      const totalPages = Math.ceil(total / limit);

      res.json({
        production,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: total,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  // Duplicate recipe
  duplicateRecipe: async (req, res, next) => {
    try {
      const originalRecipe = await Recipe.findById(req.params.id).populate(
        "ingredients.ingredient"
      );

      if (!originalRecipe) {
        return res.status(404).json({ error: "Recipe not found" });
      }

      const duplicatedRecipe = new Recipe({
        name: `${originalRecipe.name} (Copy)`,
        instructions: originalRecipe.instructions,
        preparationTime: originalRecipe.preparationTime,
        ingredients: originalRecipe.ingredients.map((ing) => ({
          ingredient: ing.ingredient._id,
          quantity: ing.quantity,
        })),
        image: originalRecipe.image,
      });

      await duplicatedRecipe.save();
      await duplicatedRecipe.populate("ingredients.ingredient");

      res.status(201).json(duplicatedRecipe);
    } catch (error) {
      next(error);
    }
  },

  // Get recipes that can be made with current inventory
  getAvailableRecipes: async (req, res, next) => {
    try {
      const recipes = await Recipe.find()
        .populate("ingredients.ingredient")
        .sort({ name: 1 });

      const availableRecipes = [];

      for (let recipe of recipes) {
        const canMake = await recipe.canMake();
        if (canMake) {
          recipe._doc.maxPortions = await recipe.maxPortions();
          recipe._doc.cost = await recipe.calculateCost();
          availableRecipes.push(recipe);
        }
      }

      res.json(availableRecipes);
    } catch (error) {
      next(error);
    }
  },
};

module.exports = recipeController;
