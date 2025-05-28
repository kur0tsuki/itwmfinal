const mongoose = require("mongoose");

const productionRecordSchema = new mongoose.Schema(
  {
    recipe: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recipe",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    notes: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

productionRecordSchema.pre("save", async function (next) {
  if (this.isNew) {
    const Recipe = mongoose.model("Recipe");
    const recipe = await Recipe.findById(this.recipe);
    recipe.preparedQuantity += this.quantity;
    await recipe.save();
  }
  next();
});

module.exports = mongoose.model("ProductionRecord", productionRecordSchema);
