const Product = require("../models/Product");
const Recipe = require("../models/Recipe");
const { validationResult } = require("express-validator");

const productController = {
  // Get all products
  getAllProducts: async (req, res, next) => {
    try {
      const {
        page = 1,
        limit = 50,
        search = "",
        isActive = null,
        sortBy = "name",
        sortOrder = "asc",
        includeInactive = false,
      } = req.query;

      const query = {};

      // Search functionality
      if (search) {
        query.name = { $regex: search, $options: "i" };
      }

      // Active status filter
      if (isActive !== null) {
        query.isActive = isActive === "true";
      } else if (!includeInactive) {
        query.isActive = true;
      }

      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

      const products = await Product.find(query)
        .populate({
          path: "recipe",
          populate: {
            path: "ingredients.ingredient",
          },
        })
        .sort(sortOptions)
        .limit(limit * 1)
        .skip((page - 1) * limit);

      // Add computed properties
      for (let product of products) {
        product._doc.cost = await product.getCost();
        product._doc.profit = await product.getProfit();
        product._doc.profit_margin = await product.getProfitMargin();
        product._doc.prepared_quantity = product.recipe.preparedQuantity;
        product._doc.can_sell = product.recipe.preparedQuantity > 0;
      }

      const total = await Product.countDocuments(query);
      const totalPages = Math.ceil(total / limit);

      res.json({
        products,
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

  // Get product by ID
  getProductById: async (req, res, next) => {
    try {
      const product = await Product.findById(req.params.id).populate({
        path: "recipe",
        populate: {
          path: "ingredients.ingredient",
        },
      });

      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      // Add computed properties
      product._doc.cost = await product.getCost();
      product._doc.profit = await product.getProfit();
      product._doc.profit_margin = await product.getProfitMargin();
      product._doc.prepared_quantity = product.recipe.preparedQuantity;
      product._doc.can_sell = product.recipe.preparedQuantity > 0;

      res.json(product);
    } catch (error) {
      next(error);
    }
  },

  // Create new product
  createProduct: async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Validate recipe exists
      const recipe = await Recipe.findById(req.body.recipe);
      if (!recipe) {
        return res.status(400).json({ error: "Recipe not found" });
      }

      const product = new Product(req.body);
      await product.save();
      await product.populate({
        path: "recipe",
        populate: {
          path: "ingredients.ingredient",
        },
      });

      // Add computed properties
      product._doc.cost = await product.getCost();
      product._doc.profit = await product.getProfit();
      product._doc.profit_margin = await product.getProfitMargin();

      res.status(201).json(product);
    } catch (error) {
      next(error);
    }
  },

  // Update product
  updateProduct: async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Validate recipe exists if provided
      if (req.body.recipe) {
        const recipe = await Recipe.findById(req.body.recipe);
        if (!recipe) {
          return res.status(400).json({ error: "Recipe not found" });
        }
      }

      const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      }).populate({
        path: "recipe",
        populate: {
          path: "ingredients.ingredient",
        },
      });

      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      // Add computed properties
      product._doc.cost = await product.getCost();
      product._doc.profit = await product.getProfit();
      product._doc.profit_margin = await product.getProfitMargin();

      res.json(product);
    } catch (error) {
      next(error);
    }
  },

  // Delete product
  deleteProduct: async (req, res, next) => {
    try {
      const product = await Product.findByIdAndDelete(req.params.id);

      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      res.json({ message: "Product deleted successfully" });
    } catch (error) {
      next(error);
    }
  },

  // Toggle product active status
  toggleProductStatus: async (req, res, next) => {
    try {
      const product = await Product.findById(req.params.id);

      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      product.isActive = !product.isActive;
      await product.save();

      await product.populate({
        path: "recipe",
        populate: {
          path: "ingredients.ingredient",
        },
      });

      res.json({
        message: `Product ${
          product.isActive ? "activated" : "deactivated"
        } successfully`,
        product,
      });
    } catch (error) {
      next(error);
    }
  },

  // Get products available for sale
  getAvailableProducts: async (req, res, next) => {
    try {
      const products = await Product.find({ isActive: true })
        .populate({
          path: "recipe",
          populate: {
            path: "ingredients.ingredient",
          },
        })
        .sort({ name: 1 });

      const availableProducts = [];

      for (let product of products) {
        if (product.recipe.preparedQuantity > 0) {
          product._doc.cost = await product.getCost();
          product._doc.profit = await product.getProfit();
          product._doc.profit_margin = await product.getProfitMargin();
          product._doc.prepared_quantity = product.recipe.preparedQuantity;
          availableProducts.push(product);
        }
      }

      res.json(availableProducts);
    } catch (error) {
      next(error);
    }
  },

  // Get product analytics
  getProductAnalytics: async (req, res, next) => {
    try {
      const Sale = require("../models/Sale");
      const { days = 30 } = req.query;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));

      const product = await Product.findById(req.params.id).populate("recipe");

      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      // Get sales data for this product
      const sales = await Sale.find({
        product: req.params.id,
        timestamp: { $gte: startDate },
      }).sort({ timestamp: 1 });

      // Calculate analytics
      const totalSales = sales.reduce((sum, sale) => sum + sale.quantity, 0);
      const totalRevenue = sales.reduce(
        (sum, sale) => sum + sale.quantity * sale.unitPrice,
        0
      );

      const cost = await product.getCost();
      const totalCost = totalSales * cost;
      const totalProfit = totalRevenue - totalCost;
      const profitMargin =
        totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

      // Daily sales breakdown
      const dailySales = {};
      sales.forEach((sale) => {
        const date = sale.timestamp.toISOString().split("T")[0];
        if (!dailySales[date]) {
          dailySales[date] = { quantity: 0, revenue: 0 };
        }
        dailySales[date].quantity += sale.quantity;
        dailySales[date].revenue += sale.quantity * sale.unitPrice;
      });

      // Convert to array format
      const chartData = Object.entries(dailySales).map(([date, data]) => ({
        date,
        quantity: data.quantity,
        revenue: data.revenue,
        profit: data.revenue - data.quantity * cost,
      }));

      res.json({
        product: {
          id: product._id,
          name: product.name,
          price: product.price,
          cost,
          profit_per_unit: product.price - cost,
          profit_margin_per_unit:
            ((product.price - cost) / product.price) * 100,
        },
        period: {
          days: parseInt(days),
          start_date: startDate.toISOString().split("T")[0],
          end_date: new Date().toISOString().split("T")[0],
        },
        summary: {
          total_sales: totalSales,
          total_revenue: totalRevenue,
          total_cost: totalCost,
          total_profit: totalProfit,
          profit_margin: profitMargin,
          average_daily_sales: totalSales / parseInt(days),
        },
        chart_data: chartData,
      });
    } catch (error) {
      next(error);
    }
  },

  // Get low stock alerts
  getLowStockAlerts: async (req, res, next) => {
    try {
      const Ingredient = require("../models/Ingredient");

      const lowStockIngredients = await Ingredient.find({
        $expr: { $lte: ["$quantity", "$minThreshold"] },
      }).sort({ quantity: 1 });

      res.json({
        count: lowStockIngredients.length,
        ingredients: lowStockIngredients,
      });
    } catch (error) {
      next(error);
    }
  },

  // Get production capacity for all products
  getProductionCapacity: async (req, res, next) => {
    try {
      const products = await Product.find({ isActive: true })
        .populate({
          path: "recipe",
          populate: {
            path: "ingredients.ingredient",
          },
        })
        .sort({ name: 1 });

      const capacityReport = [];

      for (let product of products) {
        const maxPortions = await product.recipe.maxPortions();
        const canMake = await product.recipe.canMake();

        capacityReport.push({
          product: {
            id: product._id,
            name: product.name,
            price: product.price,
          },
          recipe: {
            name: product.recipe.name,
            preparedQuantity: product.recipe.preparedQuantity,
          },
          capacity: {
            canMake,
            maxPortions: Math.floor(maxPortions),
            availableForSale: product.recipe.preparedQuantity,
          },
        });
      }

      res.json(capacityReport);
    } catch (error) {
      next(error);
    }
  },

  // Bulk update product prices
  bulkUpdatePrices: async (req, res, next) => {
    try {
      const { updates, adjustment_type, adjustment_value } = req.body;

      if (updates && Array.isArray(updates)) {
        // Individual updates
        const results = [];

        for (const update of updates) {
          try {
            const product = await Product.findByIdAndUpdate(
              update.id,
              { price: update.price },
              { new: true, runValidators: true }
            ).populate("recipe");

            if (product) {
              results.push({ success: true, product });
            } else {
              results.push({
                success: false,
                id: update.id,
                error: "Not found",
              });
            }
          } catch (error) {
            results.push({
              success: false,
              id: update.id,
              error: error.message,
            });
          }
        }

        res.json({ results });
      } else if (adjustment_type && adjustment_value) {
        // Bulk adjustment
        const products = await Product.find({ isActive: true }).populate(
          "recipe"
        );
        const results = [];

        for (const product of products) {
          try {
            let newPrice;
            if (adjustment_type === "percentage") {
              newPrice = product.price * (1 + adjustment_value / 100);
            } else if (adjustment_type === "fixed") {
              newPrice = product.price + adjustment_value;
            } else {
              throw new Error("Invalid adjustment type");
            }

            if (newPrice < 0) {
              throw new Error("Price cannot be negative");
            }

            product.price = newPrice;
            await product.save();

            results.push({ success: true, product });
          } catch (error) {
            results.push({
              success: false,
              id: product._id,
              error: error.message,
            });
          }
        }

        res.json({ results });
      } else {
        res.status(400).json({ error: "Invalid bulk update parameters" });
      }
    } catch (error) {
      next(error);
    }
  },
};

module.exports = productController;
