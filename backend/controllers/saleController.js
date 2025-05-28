const Sale = require("../models/Sale");
const Product = require("../models/Product");
const Recipe = require("../models/Recipe");
const { validationResult } = require("express-validator");

const saleController = {
  // Get all sales
  getAllSales: async (req, res, next) => {
    try {
      const {
        page = 1,
        limit = 50,
        startDate = null,
        endDate = null,
        productId = null,
        sortBy = "timestamp",
        sortOrder = "desc",
      } = req.query;

      const query = {};

      // Date range filter
      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) query.timestamp.$gte = new Date(startDate);
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          query.timestamp.$lte = end;
        }
      }

      // Product filter
      if (productId) {
        query.product = productId;
      }

      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

      const sales = await Sale.find(query)
        .populate("product")
        .sort(sortOptions)
        .limit(limit * 1)
        .skip((page - 1) * limit);

      // Add profit calculation
      for (let sale of sales) {
        sale._doc.profit = await sale.calculateProfit();
      }

      const total = await Sale.countDocuments(query);
      const totalPages = Math.ceil(total / limit);

      // Calculate summary stats for current page
      const pageRevenue = sales.reduce((sum, sale) => sum + sale.totalPrice, 0);
      const pageProfit = sales.reduce(
        (sum, sale) => sum + (sale._doc.profit || 0),
        0
      );

      res.json({
        sales,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: total,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
        summary: {
          page_revenue: pageRevenue,
          page_profit: pageProfit,
          page_transactions: sales.length,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  // Get sale by ID
  getSaleById: async (req, res, next) => {
    try {
      const sale = await Sale.findById(req.params.id).populate("product");

      if (!sale) {
        return res.status(404).json({ error: "Sale not found" });
      }

      sale._doc.profit = await sale.calculateProfit();
      res.json(sale);
    } catch (error) {
      next(error);
    }
  },

  // Create new sale
  createSale: async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Validate product exists and is active
      const product = await Product.findById(req.body.product).populate(
        "recipe"
      );
      if (!product) {
        return res.status(400).json({ error: "Product not found" });
      }

      if (!product.isActive) {
        return res.status(400).json({ error: "Product is not active" });
      }

      // Check if enough prepared quantity is available
      if (product.recipe.preparedQuantity < req.body.quantity) {
        return res.status(400).json({
          error: `Insufficient prepared quantity. Available: ${product.recipe.preparedQuantity}, Requested: ${req.body.quantity}`,
        });
      }

      const saleData = {
        ...req.body,
        unitPrice: req.body.unitPrice || product.price,
      };

      const sale = new Sale(saleData);
      await sale.save();
      await sale.populate("product");

      sale._doc.profit = await sale.calculateProfit();
      res.status(201).json(sale);
    } catch (error) {
      next(error);
    }
  },

  // Update sale (limited fields)
  updateSale: async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Only allow updating certain fields for existing sales
      const allowedUpdates = ["notes", "timestamp"];
      const updates = {};

      Object.keys(req.body).forEach((key) => {
        if (allowedUpdates.includes(key)) {
          updates[key] = req.body[key];
        }
      });

      const sale = await Sale.findByIdAndUpdate(req.params.id, updates, {
        new: true,
        runValidators: true,
      }).populate("product");

      if (!sale) {
        return res.status(404).json({ error: "Sale not found" });
      }

      sale._doc.profit = await sale.calculateProfit();
      res.json(sale);
    } catch (error) {
      next(error);
    }
  },

  // Delete sale (refund - restore prepared quantity)
  deleteSale: async (req, res, next) => {
    try {
      const sale = await Sale.findById(req.params.id).populate("product");

      if (!sale) {
        return res.status(404).json({ error: "Sale not found" });
      }

      // Restore prepared quantity
      const recipe = await Recipe.findById(sale.product.recipe);
      recipe.preparedQuantity += sale.quantity;
      await recipe.save();

      // Delete the sale
      await Sale.findByIdAndDelete(req.params.id);

      res.json({
        message: "Sale refunded successfully",
        restored_quantity: sale.quantity,
        product: sale.product.name,
      });
    } catch (error) {
      next(error);
    }
  },

  // Get sales dashboard
  getDashboard: async (req, res, next) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);

      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 30);

      // Today's sales
      const todaySales = await Sale.find({
        timestamp: { $gte: today },
      }).populate("product");

      const todayRevenue = todaySales.reduce(
        (sum, sale) => sum + sale.totalPrice,
        0
      );
      const todayCost = await Promise.all(
        todaySales.map(async (sale) => {
          const cost = await sale.product.getCost();
          return cost * sale.quantity;
        })
      ).then((costs) => costs.reduce((sum, cost) => sum + cost, 0));

      const todayProfit = todayRevenue - todayCost;
      const todayMargin =
        todayRevenue > 0 ? (todayProfit / todayRevenue) * 100 : 0;

      // Week's sales
      const weekSales = await Sale.find({
        timestamp: { $gte: weekAgo },
      }).populate("product");

      const weekRevenue = weekSales.reduce(
        (sum, sale) => sum + sale.totalPrice,
        0
      );
      const weekCost = await Promise.all(
        weekSales.map(async (sale) => {
          const cost = await sale.product.getCost();
          return cost * sale.quantity;
        })
      ).then((costs) => costs.reduce((sum, cost) => sum + cost, 0));

      const weekProfit = weekRevenue - weekCost;
      const weekMargin = weekRevenue > 0 ? (weekProfit / weekRevenue) * 100 : 0;

      // Month's sales
      const monthSales = await Sale.find({
        timestamp: { $gte: monthAgo },
      }).populate("product");

      const monthRevenue = monthSales.reduce(
        (sum, sale) => sum + sale.totalPrice,
        0
      );
      const monthCost = await Promise.all(
        monthSales.map(async (sale) => {
          const cost = await sale.product.getCost();
          return cost * sale.quantity;
        })
      ).then((costs) => costs.reduce((sum, cost) => sum + cost, 0));

      const monthProfit = monthRevenue - monthCost;
      const monthMargin =
        monthRevenue > 0 ? (monthProfit / monthRevenue) * 100 : 0;

      // Chart data for last 7 days
      const chartData = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const daySales = await Sale.find({
          timestamp: { $gte: date, $lt: nextDate },
        }).populate("product");

        const dayRevenue = daySales.reduce(
          (sum, sale) => sum + sale.totalPrice,
          0
        );
        const dayCost = await Promise.all(
          daySales.map(async (sale) => {
            const cost = await sale.product.getCost();
            return cost * sale.quantity;
          })
        ).then((costs) => costs.reduce((sum, cost) => sum + cost, 0));

        chartData.push({
          period: date.toISOString().split("T")[0],
          total_sales: dayRevenue,
          profit: dayRevenue - dayCost,
          transactions: daySales.length,
        });
      }

      // Top selling products this week
      const topProducts = await Sale.aggregate([
        {
          $match: { timestamp: { $gte: weekAgo } },
        },
        {
          $group: {
            _id: "$product",
            total_quantity: { $sum: "$quantity" },
            total_revenue: { $sum: { $multiply: ["$quantity", "$unitPrice"] } },
            transactions: { $sum: 1 },
          },
        },
        {
          $sort: { total_quantity: -1 },
        },
        {
          $limit: 5,
        },
        {
          $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "_id",
            as: "product",
          },
        },
        {
          $unwind: "$product",
        },
      ]);

      res.json({
        today: {
          revenue: todayRevenue,
          profit: todayProfit,
          profit_margin: todayMargin,
          transactions: todaySales.length,
        },
        week: {
          revenue: weekRevenue,
          profit: weekProfit,
          profit_margin: weekMargin,
          transactions: weekSales.length,
        },
        month: {
          revenue: monthRevenue,
          profit: monthProfit,
          profit_margin: monthMargin,
          transactions: monthSales.length,
        },
        chart_data: chartData,
        top_products: topProducts,
      });
    } catch (error) {
      next(error);
    }
  },

  // Get sales report
  getReport: async (req, res, next) => {
    try {
      const {
        start_date,
        end_date,
        period = "day",
        product_id = null,
      } = req.query;

      if (!start_date || !end_date) {
        return res
          .status(400)
          .json({ error: "start_date and end_date are required" });
      }

      const startDate = new Date(start_date);
      const endDate = new Date(end_date);
      endDate.setHours(23, 59, 59, 999);

      let groupBy;
      if (period === "day") {
        groupBy = { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } };
      } else if (period === "week") {
        groupBy = { $dateToString: { format: "%Y-W%U", date: "$timestamp" } };
      } else if (period === "month") {
        groupBy = { $dateToString: { format: "%Y-%m", date: "$timestamp" } };
      } else {
        return res
          .status(400)
          .json({ error: "Invalid period. Choose from: day, week, month" });
      }

      const matchQuery = {
        timestamp: { $gte: startDate, $lte: endDate },
      };

      if (product_id) {
        matchQuery.product = mongoose.Types.ObjectId(product_id);
      }

      const salesData = await Sale.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: groupBy,
            total_sales: { $sum: { $multiply: ["$quantity", "$unitPrice"] } },
            transactions: { $sum: 1 },
            items_sold: { $sum: "$quantity" },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      // Calculate costs and profits for each period
      const result = [];
      for (let periodData of salesData) {
        const periodQuery = { timestamp: { $gte: startDate, $lte: endDate } };
        if (product_id) periodQuery.product = product_id;

        const periodSales = await Sale.find(periodQuery).populate("product");

        let totalCost = 0;
        for (let sale of periodSales) {
          const cost = await sale.product.getCost();
          totalCost += cost * sale.quantity;
        }

        const revenue = periodData.total_sales;
        const profit = revenue - totalCost;

        result.push({
          period: periodData._id,
          transactions: periodData.transactions,
          items_sold: periodData.items_sold,
          total_sales: revenue,
          cost: totalCost,
          profit: profit,
          profit_margin: revenue > 0 ? (profit / revenue) * 100 : 0,
        });
      }

      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  },

  // Get best selling products
  getBestSellers: async (req, res, next) => {
    try {
      const { days = 30, limit = 10 } = req.query;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));

      const bestSellers = await Sale.aggregate([
        {
          $match: { timestamp: { $gte: startDate } },
        },
        {
          $group: {
            _id: "$product",
            total_quantity: { $sum: "$quantity" },
            total_revenue: { $sum: { $multiply: ["$quantity", "$unitPrice"] } },
            transactions: { $sum: 1 },
            avg_quantity_per_transaction: { $avg: "$quantity" },
          },
        },
        {
          $sort: { total_quantity: -1 },
        },
        {
          $limit: parseInt(limit),
        },
        {
          $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "_id",
            as: "product",
          },
        },
        {
          $unwind: "$product",
        },
        {
          $lookup: {
            from: "recipes",
            localField: "product.recipe",
            foreignField: "_id",
            as: "recipe",
          },
        },
        {
          $unwind: "$recipe",
        },
      ]);

      // Calculate profit for each product
      for (let item of bestSellers) {
        const cost = await item.recipe.calculateCost();
        item.unit_cost = cost;
        item.unit_profit = item.product.price - cost;
        item.total_profit = item.unit_profit * item.total_quantity;
        item.profit_margin =
          item.product.price > 0
            ? (item.unit_profit / item.product.price) * 100
            : 0;
      }

      res.json(bestSellers);
    } catch (error) {
      next(error);
    }
  },
};

module.exports = saleController;
