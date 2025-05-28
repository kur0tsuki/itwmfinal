import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getRecipe, createRecipe, updateRecipe } from "../../api/api";
import { useAppContext } from "../../context/AppContext";
import LoadingSpinner from "../common/LoadingSpinner";
import AlertMessage from "../common/AlertMessage";

const RecipeForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { ingredients, refreshData } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    description: "", // This will be mapped to instructions when submitting
    preparation_time: 0,
    recipe_ingredients: [], // This will be mapped to ingredients when submitting
  });

  useEffect(() => {
    if (id && /^[0-9a-fA-F]{24}$/.test(id)) {
      fetchRecipeDetails();
    } else if (id) {
      setError("Invalid recipe ID format");
      console.error("Invalid recipe ID:", id);
    }
  }, [id]);

  const fetchRecipeDetails = async () => {
    try {
      setLoading(true);
      console.log("Fetching recipe with ID:", id);
      const response = await getRecipe(id);
      console.log("Recipe response:", response); // Add debug logging

      if (!response.data) {
        throw new Error("No recipe data received");
      }

      const formattedData = {
        name: response.data.name,
        description: response.data.instructions || "",
        preparation_time: response.data.preparationTime || 0,
        recipe_ingredients:
          response.data.ingredients?.map((ri) => ({
            ingredient: ri.ingredient._id,
            quantity: ri.quantity,
          })) || [],
      };
      setFormData(formattedData);
      setError("");
    } catch (err) {
      console.error("Recipe fetch error:", {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
        id: id,
      });
      setError(err.response?.data?.error || "Failed to fetch recipe details");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleIngredientChange = (idx, field, value) => {
    const updatedIngredients = [...formData.recipe_ingredients];
    updatedIngredients[idx][field] = value;
    setFormData((prev) => ({
      ...prev,
      recipe_ingredients: updatedIngredients,
    }));
  };

  const addIngredient = () => {
    setFormData((prev) => ({
      ...prev,
      recipe_ingredients: [
        ...prev.recipe_ingredients,
        { ingredient: "", quantity: 0 },
      ],
    }));
  };

  const removeIngredient = (idx) => {
    const updatedIngredients = [...formData.recipe_ingredients];
    updatedIngredients.splice(idx, 1);
    setFormData((prev) => ({
      ...prev,
      recipe_ingredients: updatedIngredients,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);

      // Validate ingredients
      if (!formData.recipe_ingredients.length) {
        setError("Recipe must have at least one ingredient");
        setLoading(false);
        return;
      }

      // Validate each ingredient has both id and quantity
      const invalidIngredients = formData.recipe_ingredients.some(
        (ri) => !ri.ingredient || !ri.quantity || ri.quantity <= 0
      );

      if (invalidIngredients) {
        setError("All ingredients must have a valid selection and quantity");
        setLoading(false);
        return;
      }

      const dataToSubmit = {
        name: formData.name.trim(),
        instructions: formData.description.trim(), // Backend expects 'instructions' not 'description'
        preparationTime: parseInt(formData.preparation_time, 10),
        ingredients: formData.recipe_ingredients.map((ri) => ({
          ingredient: ri.ingredient,
          quantity: parseFloat(ri.quantity),
        })),
      };

      if (id) {
        await updateRecipe(id, dataToSubmit);
      } else {
        await createRecipe(dataToSubmit);
      }

      await refreshData();
      navigate("/recipes");
    } catch (err) {
      const errorMessage = err.response?.data?.error || "Failed to save recipe";
      setError(errorMessage);
      console.error("Recipe save error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && id) return <LoadingSpinner />;

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6">
      <h2 className="text-lg font-medium mb-6">
        {id ? "Edit Recipe" : "New Recipe"}
      </h2>

      {error && <AlertMessage type="error" message={error} />}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700"
          >
            Recipe Name
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
            htmlFor="description"
            className="block text-sm font-medium text-gray-700"
          >
            Description
          </label>
          <textarea
            name="description"
            id="description"
            rows="3"
            value={formData.description}
            onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          />
        </div>

        <div>
          <label
            htmlFor="preparation_time"
            className="block text-sm font-medium text-gray-700"
          >
            Preparation Time (minutes)
          </label>
          <input
            type="number"
            name="preparation_time"
            id="preparation_time"
            required
            min="1"
            value={formData.preparation_time}
            onChange={handleChange}
            className="mt-1 block w-full md:w-1/4 border border-gray-300 rounded-md shadow-sm p-2"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Recipe Ingredients
            </label>
            <button
              type="button"
              onClick={addIngredient}
              className="px-3 py-1 border border-transparent text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              Add Ingredient
            </button>
          </div>

          {formData.recipe_ingredients.length === 0 ? (
            <p className="text-gray-500 text-sm">No ingredients added yet.</p>
          ) : (
            <div className="space-y-3">
              {formData.recipe_ingredients.map((ri, idx) => (
                <div key={idx} className="flex items-center space-x-3">
                  <select
                    value={ri.ingredient}
                    onChange={(e) =>
                      handleIngredientChange(idx, "ingredient", e.target.value)
                    }
                    required
                    className="block w-1/2 border border-gray-300 rounded-md shadow-sm p-2"
                  >
                    <option value="">Select Ingredient</option>
                    {ingredients.map((ing) => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} ({ing.quantity} {ing.unit} available)
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    value={ri.quantity}
                    onChange={(e) =>
                      handleIngredientChange(idx, "quantity", e.target.value)
                    }
                    placeholder="Quantity"
                    required
                    min="0.01"
                    step="0.01"
                    className="block w-1/4 border border-gray-300 rounded-md shadow-sm p-2"
                  />

                  <button
                    type="button"
                    onClick={() => removeIngredient(idx)}
                    className="p-2 text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate("/recipes")}
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

export default RecipeForm;
