const Ingredient = require("../models/Ingredient");
const { validationResult } = require("express-validator");

const ingredientController = {
  // Get all ingredients
  getAllIngredients: async (req, res, next) => {
    try {
      const {
        page = 1,
        limit = 50,
        search = "",
        lowStock = false,
        sortBy = "name",
        sortOrder = "asc",
      } = req.query;

      const query = {};

      // Search functionality
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { unit: { $regex: search, $options: "i" } },
        ];
      }

      // Low stock filter
      if (lowStock === "true") {
        query.$expr = { $lte: ["$quantity", "$minThreshold"] };
      }

      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

      const ingredients = await Ingredient.find(query)
        .sort(sortOptions)
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Ingredient.countDocuments(query);
      const totalPages = Math.ceil(total / limit);

      res.json({
        ingredients,
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

  // Get ingredient by ID
  getIngredientById: async (req, res, next) => {
    try {
      const ingredient = await Ingredient.findById(req.params.id);

      if (!ingredient) {
        return res.status(404).json({ error: "Ingredient not found" });
      }

      res.json(ingredient);
    } catch (error) {
      next(error);
    }
  },

  // Create new ingredient
  createIngredient: async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const ingredient = new Ingredient(req.body);
      await ingredient.save();

      res.status(201).json(ingredient);
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(400)
          .json({ error: "Ingredient name already exists" });
      }
      next(error);
    }
  },

  // Update ingredient
  updateIngredient: async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const ingredient = await Ingredient.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      );

      if (!ingredient) {
        return res.status(404).json({ error: "Ingredient not found" });
      }

      res.json(ingredient);
    } catch (error) {
      if (error.code === 11000) {
        return res
          .status(400)
          .json({ error: "Ingredient name already exists" });
      }
      next(error);
    }
  },

  // Delete ingredient
  deleteIngredient: async (req, res, next) => {
    try {
      const ingredient = await Ingredient.findByIdAndDelete(req.params.id);

      if (!ingredient) {
        return res.status(404).json({ error: "Ingredient not found" });
      }

      res.json({ message: "Ingredient deleted successfully" });
    } catch (error) {
      next(error);
    }
  },

  // Restock ingredient
  restockIngredient: async (req, res, next) => {
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

      res.json({
        message: `Successfully restocked ${amount} ${ingredient.unit} of ${ingredient.name}`,
        ingredient,
      });
    } catch (error) {
      next(error);
    }
  },

  // Get low stock ingredients
  getLowStockIngredients: async (req, res, next) => {
    try {
      const ingredients = await Ingredient.find({
        $expr: { $lte: ["$quantity", "$minThreshold"] },
      }).sort({ name: 1 });

      res.json(ingredients);
    } catch (error) {
      next(error);
    }
  },

  // Bulk update ingredients
  bulkUpdateIngredients: async (req, res, next) => {
    try {
      const { updates } = req.body;

      if (!Array.isArray(updates)) {
        return res.status(400).json({ error: "Updates must be an array" });
      }

      const results = [];

      for (const update of updates) {
        try {
          const ingredient = await Ingredient.findByIdAndUpdate(
            update.id,
            update.data,
            { new: true, runValidators: true }
          );

          if (ingredient) {
            results.push({ success: true, ingredient });
          } else {
            results.push({ success: false, id: update.id, error: "Not found" });
          }
        } catch (error) {
          results.push({ success: false, id: update.id, error: error.message });
        }
      }

      res.json({ results });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = ingredientController;
