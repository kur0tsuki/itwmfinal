import React from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../../context/AppContext";
import LoadingSpinner from "../common/LoadingSpinner";
import { formatCurrency } from "../../utils/format";

const ProductList = () => {
  const { products, loading } = useAppContext();

  if (loading) return <LoadingSpinner />;

  const calculateProductMetrics = (product) => {
    // Get cost from computed backend value
    const cost = product.cost || 0;
    const price = product.price || 0;
    const profit = price - cost;
    const margin = price > 0 ? (profit / price) * 100 : 0;

    return {
      cost: formatCurrency(cost),
      profit: formatCurrency(profit),
      margin: margin.toFixed(1),
    };
  };

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-md">
      <ul className="divide-y divide-gray-200">
        {products.map((product) => {
          const metrics = calculateProductMetrics(product);
          return (
            <li key={product._id}>
              <div className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="truncate">
                    <p className="text-sm font-medium text-blue-600 truncate">
                      {product.name}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      Based on: {product.recipe?.name || "No recipe"}
                    </p>
                  </div>
                  <div className="ml-2 flex-shrink-0 flex">
                    <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      {formatCurrency(product.price || 0)}
                    </p>
                    <Link
                      to={`/products/${product._id}`}
                      className="ml-2 inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-xs font-medium rounded bg-white text-gray-700 hover:bg-gray-50"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
                <div className="mt-2 flex justify-between">
                  <div className="text-sm text-gray-500">
                    Cost: {metrics.cost} • Profit: {metrics.profit} • Margin:{" "}
                    {metrics.margin}%
                  </div>
                  <div>
                    {product.isActive ? (
                      <span className="text-xs text-green-600">Active</span>
                    ) : (
                      <span className="text-xs text-red-600">Inactive</span>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ProductList;
