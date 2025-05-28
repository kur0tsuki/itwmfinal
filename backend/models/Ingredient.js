const mongoose = require("mongoose");

const ingredientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      maxlength: 100,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    unit: {
      type: String,
      required: true,
      maxlength: 20,
    },
    minThreshold: {
      type: Number,
      default: 0,
      min: 0,
    },
    costPerUnit: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

ingredientSchema.virtual("isLowStock").get(function () {
  return this.quantity <= this.minThreshold;
});

ingredientSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("Ingredient", ingredientSchema);
