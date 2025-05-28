const mongoose = require("mongoose");

const saleSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

saleSchema.virtual("totalPrice").get(function () {
  return this.quantity * this.unitPrice;
});

saleSchema.methods.calculateProfit = async function () {
  await this.populate("product");
  const unitProfit = await this.product.getProfit();
  return unitProfit * this.quantity;
};

saleSchema.pre("save", async function (next) {
  if (this.isNew) {
    const Recipe = mongoose.model("Recipe");
    await this.populate("product");
    const recipe = await Recipe.findById(this.product.recipe);

    if (recipe.preparedQuantity < this.quantity) {
      const error = new Error(
        `Cannot sell ${this.quantity} ${this.product.name}(s). Only ${recipe.preparedQuantity} prepared.`
      );
      error.statusCode = 400;
      return next(error);
    }

    recipe.preparedQuantity -= this.quantity;
    await recipe.save();

    if (!this.unitPrice) {
      this.unitPrice = this.product.price;
    }
  }
  next();
});

saleSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("Sale", saleSchema);
