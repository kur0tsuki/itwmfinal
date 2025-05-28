import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getProduct, createProduct, updateProduct } from "../../api/api";
import { useAppContext } from "../../context/AppContext";
import LoadingSpinner from "../common/LoadingSpinner";
import AlertMessage from "../common/AlertMessage";
import { formatCurrency } from "../../utils/format";

const ProductForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { recipes, refreshData } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    recipe: "",
    price: 0,
    is_active: true,
  });
  const [selectedRecipe, setSelectedRecipe] = useState(null);

  useEffect(() => {
    if (id && /^[0-9a-fA-F]{24}$/.test(id)) {
      // Validate MongoDB ID format
      console.log("Valid product ID, fetching details:", id);
      fetchProductDetails();
    } else if (id) {
      console.error("Invalid product ID format:", id);
      setError("Invalid product ID format");
    }
  }, [id]);

  useEffect(() => {
    if (formData.recipe && recipes.length > 0) {
      // Using _id instead of id since MongoDB uses _id
      const recipe = recipes.find((r) => r._id === formData.recipe);
      console.log("Selected recipe:", recipe); // Debug log
      setSelectedRecipe(recipe || null);
    } else {
      setSelectedRecipe(null);
    }
  }, [formData.recipe, recipes]);

  const fetchProductDetails = async () => {
    try {
      setLoading(true);
      console.log("Fetching product with ID:", id);
      const { data } = await getProduct(id);

      if (!data) {
        throw new Error("No product data received");
      }

      console.log("Product data received:", data); // Debug log

      const formattedData = {
        name: data.name,
        recipe: data.recipe?._id, // Use optional chaining
        price: data.price || 0,
        is_active: data.isActive ?? true, // Use nullish coalescing
      };

      setFormData(formattedData);
      setError("");
    } catch (err) {
      const errorMessage =
        err.response?.data?.error || "Failed to fetch product details";
      setError(errorMessage);
      console.error("Product fetch error:", {
        message: errorMessage,
        status: err.response?.status,
        data: err.response?.data,
        id: id,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");

      // Validate required fields
      if (!formData.name.trim() || !formData.recipe || !formData.price) {
        setError("Please fill in all required fields");
        return;
      }

      const dataToSubmit = {
        name: formData.name.trim(),
        recipe: formData.recipe,
        price: parseFloat(formData.price),
        isActive: formData.is_active,
      };

      console.log("Submitting data:", dataToSubmit); // Debug log

      if (id) {
        await updateProduct(id, dataToSubmit);
      } else {
        await createProduct(dataToSubmit);
      }
      await refreshData();
      navigate("/products");
    } catch (err) {
      const errorMessage =
        err.response?.data?.error || "Failed to save product";
      setError(errorMessage);
      console.error("Product save error:", {
        message: errorMessage,
        data: err.response?.data,
        status: err.response?.status,
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading && id) return <LoadingSpinner />;

  const calculatePricingDetails = () => {
    const price = parseFloat(formData.price) || 0;

    // Calculate cost from recipe ingredients
    const cost =
      selectedRecipe?.ingredients?.reduce((total, ri) => {
        const ingredientCost = ri.ingredient?.costPerUnit || 0;
        const quantity = ri.quantity || 0;
        return total + ingredientCost * quantity;
      }, 0) || 0;

    const profit = price - cost;
    const margin = price > 0 ? (profit / price) * 100 : 0;

    return {
      price: formatCurrency(price),
      cost: formatCurrency(cost),
      profit: formatCurrency(profit),
      margin: margin.toFixed(1),
    };
  };

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6">
      <h2 className="text-lg font-medium mb-6">
        {id ? "Edit Product" : "New Product"}
      </h2>

      {error && <AlertMessage type="error" message={error} />}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700"
          >
            Product Name
          </label>
          <input
            type="text"
            name="name"
            id="name"
            required
            value={formData.name}
            onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          />
        </div>

        <div>
          <label
            htmlFor="recipe"
            className="block text-sm font-medium text-gray-700"
          >
            Based on Recipe
          </label>
          <select
            name="recipe"
            id="recipe"
            required
            value={formData.recipe}
            onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          >
            <option value="">Select a Recipe</option>
            {recipes.map((recipe) => (
              // Use _id instead of id
              <option key={recipe._id} value={recipe._id}>
                {recipe.name}
              </option>
            ))}
          </select>
        </div>

        {selectedRecipe && (
          <div className="bg-gray-50 p-4 rounded-md">
            <h3 className="font-medium text-sm text-gray-700 mb-2">
              Recipe Details
            </h3>
            <p className="text-sm text-gray-600 mb-1">
              Preparation time: {selectedRecipe.preparation_time} minutes
            </p>
            <p className="text-sm text-gray-600">
              Cost per serving:{" "}
              {formatCurrency(selectedRecipe.cost_per_serving)}
            </p>
          </div>
        )}

        <div>
          <label
            htmlFor="price"
            className="block text-sm font-medium text-gray-700"
          >
            Price
          </label>
          <input
            type="number"
            name="price"
            id="price"
            required
            min="0.01"
            step="0.01"
            value={formData.price}
            onChange={handleChange}
            className="mt-1 block w-full md:w-1/4 border border-gray-300 rounded-md shadow-sm p-2"
          />
        </div>

        {selectedRecipe && formData.price > 0 && (
          <div className="bg-blue-50 p-4 rounded-md">
            <h3 className="font-medium text-sm text-blue-700 mb-2">
              Pricing Analysis
            </h3>
            {(() => {
              const pricing = calculatePricingDetails();
              return (
                <>
                  <p className="text-sm text-blue-600 mb-1">
                    Cost: {pricing.cost}
                  </p>
                  <p className="text-sm text-blue-600 mb-1">
                    Price: {pricing.price}
                  </p>
                  <p className="text-sm text-blue-600 mb-1">
                    Profit: {pricing.profit}
                  </p>
                  <p className="text-sm text-blue-600">
                    Profit Margin: {pricing.margin}%
                  </p>
                </>
              );
            })()}
          </div>
        )}

        <div className="flex items-center">
          <input
            type="checkbox"
            name="is_active"
            id="is_active"
            checked={formData.is_active}
            onChange={handleChange}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label
            htmlFor="is_active"
            className="ml-2 block text-sm text-gray-900"
          >
            Active (available for sale)
          </label>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate("/products")}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProductForm;
