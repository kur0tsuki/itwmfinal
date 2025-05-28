const express = require("express");
const router = express.Router();
const Sale = require("../models/Sale");
const Product = require("../models/Product");

// GET /api/sales
router.get("/", async (req, res, next) => {
  try {
    const sales = await Sale.find()
      .populate({
        path: "product",
        select: "name price",
        populate: {
          path: "recipe",
          select: "cost",
        },
      })
      .sort({ createdAt: -1 });

    const formattedSales = sales.map((sale) => ({
      _id: sale._id,
      createdAt: sale.createdAt,
      product: {
        _id: sale.product?._id,
        name: sale.product?.name || "Unknown Product",
      },
      quantity: sale.quantity,
      unitPrice: sale.unitPrice,
      profit: sale.profit,
      total: sale.quantity * sale.unitPrice,
    }));

    res.json(formattedSales);
  } catch (error) {
    next(error);
  }
});

// POST /api/sales
router.post("/", async (req, res, next) => {
  try {
    const sale = new Sale(req.body);
    await sale.save();
    await sale.populate("product");
    sale._doc.profit = await sale.calculateProfit();
    res.status(201).json(sale);
  } catch (error) {
    next(error);
  }
});

// GET /api/sales/dashboard
router.get("/dashboard", async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

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
      chart_data: chartData,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/sales/report
router.get("/report", async (req, res, next) => {
  try {
    const { start_date, end_date, period = "day" } = req.query;

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

    const salesData = await Sale.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: groupBy,
          total_sales: { $sum: { $multiply: ["$quantity", "$unitPrice"] } },
          transactions: { $sum: 1 },
          items_sold: { $sum: "$quantity" },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Calculate costs and profits for each period
    const result = [];
    for (let periodData of salesData) {
      const periodSales = await Sale.find({
        timestamp: { $gte: startDate, $lte: endDate },
      }).populate("product");

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
});

module.exports = router;
