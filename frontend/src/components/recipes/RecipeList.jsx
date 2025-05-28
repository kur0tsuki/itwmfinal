import React from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../../context/AppContext";
import LoadingSpinner from "../common/LoadingSpinner";
import { prepareRecipe } from "../../api/api";

const RecipeList = () => {
  const { recipes, loading, refreshData } = useAppContext();
  const [preparing, setPreparing] = React.useState(null);
  const [quantity, setQuantity] = React.useState("");
  const [error, setError] = React.useState("");
  const [preparingLoading, setPreparingLoading] = React.useState(false);

  const handlePrepare = async (id) => {
    if (!quantity || isNaN(quantity) || parseFloat(quantity) <= 0) {
      setError("Please enter a valid quantity");
      return;
    }

    try {
      setPreparingLoading(true);
      await prepareRecipe(id, parseFloat(quantity));
      setPreparing(null);
      setQuantity("");
      setError("");
      await refreshData();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to prepare recipe");
      console.error("Prepare error:", err);
    } finally {
      setPreparingLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-md">
      <ul className="divide-y divide-gray-200">
        {recipes.map((recipe) => (
          <li key={recipe._id}>
            <div className="px-4 py-4 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="truncate">
                  <p className="text-sm font-medium text-blue-600 truncate">
                    {recipe.name}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {recipe.ingredients_count} ingredients •{" "}
                    {recipe.preparation_time} mins
                  </p>
                </div>
                <div className="ml-2 flex-shrink-0 flex">
                  {preparing === recipe._id ? (
                    <div className="flex items-center">
                      <input
                        type="number"
                        step="1"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="mr-2 w-20 border rounded p-1"
                        placeholder="Qty"
                      />
                      <button
                        onClick={() => handlePrepare(recipe._id)}
                        disabled={preparingLoading}
                        className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700"
                      >
                        {preparingLoading ? "Preparing..." : "Prepare"}
                      </button>
                      <button
                        onClick={() => {
                          setPreparing(null);
                          setQuantity("");
                          setError("");
                        }}
                        className="ml-2 inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-xs font-medium rounded bg-white text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => setPreparing(recipe._id)}
                        className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded bg-green-600 text-white hover:bg-green-700 mr-2"
                        disabled={recipe.maxPortions <= 0}
                      >
                        Prepare
                      </button>
                      <Link
                        to={`/recipes/${recipe._id}`}
                        className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-xs font-medium rounded bg-white text-gray-700 hover:bg-gray-50"
                      >
                        Edit
                      </Link>
                    </>
                  )}
                </div>
              </div>
              {recipe.maxPortions <= 0 ? (
                <p className="mt-1 text-sm text-red-600">
                  Insufficient ingredients to prepare this recipe!
                </p>
              ) : (
                <p className="mt-1 text-sm text-green-600">
                  Can make up to {recipe.maxPortions.toFixed(2)} {recipe.name}
                  (s)
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
      {error && <div className="p-4 text-red-600 text-sm">{error}</div>}
    </div>
  );
};

export default RecipeList;
