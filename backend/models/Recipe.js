const mongoose = require("mongoose");

const recipeIngredientSchema = new mongoose.Schema({
  ingredient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Ingredient",
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
  },
});

const recipeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      maxlength: 100,
    },
    instructions: {
      type: String,
      default: "",
    },
    preparationTime: {
      type: Number,
      default: 0,
      min: 0,
    },
    ingredients: [recipeIngredientSchema],
    image: {
      type: String,
      default: null,
    },
    preparedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

recipeSchema.methods.canMake = async function () {
  await this.populate("ingredients.ingredient");

  for (let recipeIngredient of this.ingredients) {
    if (recipeIngredient.ingredient.quantity < recipeIngredient.quantity) {
      return false;
    }
  }
  return true;
};

recipeSchema.methods.maxPortions = async function () {
  if (this.ingredients.length === 0) return 0;

  await this.populate("ingredients.ingredient");

  const portions = this.ingredients
    .filter((ri) => ri.quantity > 0)
    .map((ri) => ri.ingredient.quantity / ri.quantity)
    .filter((portion) => portion > 0);

  return portions.length > 0 ? Math.min(...portions) : 0;
};

recipeSchema.methods.calculateCost = async function () {
  await this.populate("ingredients.ingredient");

  return this.ingredients.reduce((total, ri) => {
    return total + ri.quantity * ri.ingredient.costPerUnit;
  }, 0);
};

module.exports = mongoose.model("Recipe", recipeSchema);
