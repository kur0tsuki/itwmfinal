const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    recipe: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recipe",
      required: true,
    },
    name: {
      type: String,
      required: true,
      maxlength: 100,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

productSchema.methods.getCost = async function () {
  await this.populate({
    path: "recipe",
    populate: {
      path: "ingredients.ingredient",
    },
  });

  if (!this.recipe) return 0;

  // Calculate total cost from recipe ingredients
  return this.recipe.ingredients.reduce((total, ri) => {
    const ingredientCost = ri.ingredient?.costPerUnit || 0;
    const quantity = ri.quantity || 0;
    return total + ingredientCost * quantity;
  }, 0);
};

productSchema.methods.getProfitMargin = async function () {
  const cost = await this.getCost();
  if (cost === 0) return 100;
  return ((this.price - cost) / this.price) * 100;
};

productSchema.methods.getProfit = async function () {
  const cost = await this.getCost();
  return this.price - cost;
};

module.exports = mongoose.model("Product", productSchema);
