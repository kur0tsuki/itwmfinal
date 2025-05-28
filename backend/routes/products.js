const express = require("express");
const router = express.Router();
const Product = require("../models/Product");

// GET /api/products
router.get("/", async (req, res, next) => {
  try {
    const products = await Product.find().populate({
      path: "recipe",
      populate: {
        path: "ingredients.ingredient",
      },
    });

    // Calculate preparedQuantity for each product
    const productsWithQuantities = await Promise.all(
      products.map(async (product) => {
        const productObj = product.toObject();

        // Match the MongoDB field name
        productObj.preparedQuantity = product.recipe?.preparedQuantity || 0;

        return productObj;
      })
    );

    res.json(productsWithQuantities);
  } catch (error) {
    next(error);
  }
});

// POST /api/products
router.post("/", async (req, res, next) => {
  try {
    const product = new Product(req.body);
    await product.save();
    await product.populate("recipe");

    product._doc.cost = await product.getCost();
    product._doc.profit = await product.getProfit();
    product._doc.profit_margin = await product.getProfitMargin();

    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
});

// PUT /api/products/:id
router.put("/:id", async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate("recipe");

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    product._doc.cost = await product.getCost();
    product._doc.profit = await product.getProfit();
    product._doc.profit_margin = await product.getProfitMargin();

    res.json(product);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/products/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    next(error);
  }
});

// GET /api/products/:id
router.get("/:id", async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).populate({
      path: "recipe",
      populate: {
        path: "ingredients.ingredient",
      },
    });

    if (!product) {
      return res
        .status(404)
        .json({ error: `Product not found with id: ${req.params.id}` });
    }

    // Add computed properties
    product._doc.cost = await product.getCost();
    product._doc.profit = await product.getProfit();
    product._doc.profit_margin = await product.getProfitMargin();
    product._doc.prepared_quantity = product.recipe.preparedQuantity;

    res.json(product);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
