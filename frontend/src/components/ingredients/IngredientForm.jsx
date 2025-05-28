import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getIngredient,
  createIngredient,
  updateIngredient,
} from "../../api/api";
import { useAppContext } from "../../context/AppContext";
import LoadingSpinner from "../common/LoadingSpinner";
import AlertMessage from "../common/AlertMessage";

const IngredientForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { refreshData } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    quantity: 0,
    unit: "",
    minThreshold: 0, // Changed from min_threshold
    costPerUnit: 0, // Changed from cost_per_unit
  });

  useEffect(() => {
    if (id) {
      fetchIngredientDetails();
    }
  }, [id]);

  const fetchIngredientDetails = async () => {
    try {
      setLoading(true);
      const { data } = await getIngredient(id);
      console.log("Raw ingredient data:", data); // Debug log

      if (!data) {
        throw new Error("No ingredient data received");
      }

      // Format the data to match form fields with number conversion
      const formattedData = {
        name: data.name || "",
        quantity: Number(data.quantity) || 0,
        unit: data.unit || "",
        minThreshold: Number(data.minThreshold) || 0,
        costPerUnit: Number(data.costPerUnit) || 0,
      };

      console.log("Formatted form data:", formattedData); // Debug log
      setFormData(formattedData);
      setError("");
    } catch (err) {
      const errorMessage =
        err.response?.data?.error || "Failed to fetch ingredient details";
      setError(errorMessage);
      console.error("Ingredient fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");

      const validatedData = {
        name: formData.name.trim(),
        quantity: parseFloat(formData.quantity),
        unit: formData.unit.trim(),
        minThreshold: parseFloat(formData.minThreshold), // Changed from min_threshold
        costPerUnit: parseFloat(formData.costPerUnit), // Changed from cost_per_unit
      };

      // Check for required fields
      if (!validatedData.name || !validatedData.unit) {
        setError("Name and unit are required");
        return;
      }

      if (id) {
        await updateIngredient(id, validatedData);
      } else {
        await createIngredient(validatedData);
      }

      await refreshData();
      navigate("/ingredients");
    } catch (err) {
      const errorMessage =
        err.response?.data?.error || "Failed to save ingredient";
      setError(errorMessage);
      console.error("Ingredient save error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && id) return <LoadingSpinner />;

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg p-6">
      <h2 className="text-lg font-medium mb-6">
        {id ? "Edit Ingredient" : "New Ingredient"}
      </h2>

      {error && <AlertMessage type="error" message={error} />}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700"
          >
            Ingredient Name
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label
              htmlFor="quantity"
              className="block text-sm font-medium text-gray-700"
            >
              Quantity
            </label>
            <input
              type="number"
              name="quantity"
              id="quantity"
              required
              min="0"
              step="0.01"
              value={formData.quantity}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
          </div>

          <div>
            <label
              htmlFor="unit"
              className="block text-sm font-medium text-gray-700"
            >
              Unit
            </label>
            <input
              type="text"
              name="unit"
              id="unit"
              required
              value={formData.unit}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label
              htmlFor="minThreshold"
              className="block text-sm font-medium text-gray-700"
            >
              Minimum Threshold
            </label>
            <input
              type="number"
              name="minThreshold" // Changed from min_threshold
              id="minThreshold" // Changed from min_threshold
              required
              min="0"
              step="0.01"
              value={formData.minThreshold} // Changed from min_threshold
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
          </div>

          <div>
            <label
              htmlFor="costPerUnit"
              className="block text-sm font-medium text-gray-700"
            >
              Cost Per Unit
            </label>
            <input
              type="number"
              name="costPerUnit" // Changed from cost_per_unit
              id="costPerUnit" // Changed from cost_per_unit
              required
              min="0"
              step="0.01"
              value={formData.costPerUnit} // Changed from cost_per_unit
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate("/ingredients")}
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

export default IngredientForm;
