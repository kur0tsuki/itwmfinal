import React, { useState, useEffect } from "react";
import { useAppContext } from "../../context/AppContext";
import { createSale } from "../../api/api";
import LoadingSpinner from "../common/LoadingSpinner";
import AlertMessage from "../common/AlertMessage";
import { formatCurrency } from "../../utils/format";

const PointOfSale = () => {
  const { products, loaded, loading, refreshData } = useAppContext();
  const [cart, setCart] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const handleAddToCart = (product) => {
    // Change from prepared_quantity to preparedQuantity to match MongoDB
    const prepared = Number(product.preparedQuantity) || 0;

    if (prepared <= 0) {
      setMessage({
        type: "error",
        text: `Cannot add ${product.name} - Insufficient ingredients`,
      });
      return;
    }

    const existingItem = cart.find((item) => item.product._id === product._id);
    const currentQuantity = existingItem ? existingItem.quantity : 0;
    const newQuantity = currentQuantity + 1;

    if (newQuantity > prepared) {
      setMessage({
        type: "error",
        text: `Only ${prepared.toFixed(2)} ${product.name}(s) available`,
      });
      return;
    }

    if (existingItem) {
      setCart(
        cart.map((item) =>
          item.product._id === product._id
            ? { ...item, quantity: newQuantity }
            : item
        )
      );
    } else {
      setCart([
        ...cart,
        {
          product,
          quantity: 1,
          unitPrice: product.price, // Changed from unit_price to match backend
        },
      ]);
    }
    setMessage({ type: "", text: "" });
  };

  useEffect(() => {
    const interval = setInterval(() => {
      refreshData();
    }, 60000);

    return () => clearInterval(interval);
  }, [refreshData]);

  const handleRemoveFromCart = (productId) => {
    // Change from id to _id
    setCart(cart.filter((item) => item.product._id !== productId));
  };

  const handleUpdateQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      handleRemoveFromCart(productId);
      return;
    }

    const cartItem = cart.find((item) => item.product._id === productId);
    if (!cartItem) return;

    const currentProduct = products.find((p) => p._id === productId);
    const prepared = Number(currentProduct?.preparedQuantity) || 0; // Changed field name

    if (newQuantity > prepared) {
      setMessage({
        type: "error",
        text: `Only ${prepared.toFixed(2)} ${currentProduct.name}(s) available`,
      });
      return;
    }

    setCart(
      cart.map((item) =>
        item.product._id === productId
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
    setMessage({ type: "", text: "" });
  };

  const calculateTotal = () =>
    cart.reduce((total, item) => total + item.quantity * item.unitPrice, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    setProcessing(true);
    setMessage({ type: "", text: "" });

    try {
      // Create sale records one at a time to handle errors better
      for (const item of cart) {
        const saleData = {
          product: item.product._id, // Ensure we're using MongoDB _id
          quantity: parseInt(item.quantity),
          unitPrice: parseFloat(item.unitPrice), // Match backend schema naming
        };

        console.log("Creating sale with data:", saleData); // Debug log
        await createSale(saleData);
      }

      setMessage({
        type: "success",
        text: "Sale completed successfully!",
      });
      setCart([]);
      await refreshData();
    } catch (err) {
      console.error("Checkout error:", err.response?.data || err);
      setMessage({
        type: "error",
        text: err.response?.data?.error || "Failed to process sale",
      });
    } finally {
      setProcessing(false);
    }
  };

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

  if (!loaded || loading) return <LoadingSpinner />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Products List */}
      <div className="lg:col-span-2">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium mb-4">Products</h2>

          {message.text && (
            <AlertMessage type={message.type} message={message.text} />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products
              .filter((p) => p.isActive) // Change from is_active to isActive
              .map((product) => {
                const prepared = Number(product.preparedQuantity) || 0;
                // Use the same margin calculation from ProductList
                const metrics = calculateProductMetrics(product);

                return (
                  <div
                    key={product._id}
                    className={`border rounded-lg p-4 cursor-pointer hover:shadow-md ${
                      prepared <= 0 ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                    onClick={() => prepared > 0 && handleAddToCart(product)}
                  >
                    <h3 className="font-medium">{product.name}</h3>
                    <p className="text-gray-500 text-sm">
                      {product.recipe?.name || "No recipe"}
                    </p>
                    <div className="flex justify-between items-center mt-2">
                      <span className="font-bold text-lg">
                        {formatCurrency(product.price)}
                      </span>
                      <span className="text-sm text-gray-500">
                        Margin: {metrics.margin}%
                      </span>
                    </div>
                    {prepared <= 0 ? (
                      <p className="text-red-500 text-xs mt-1">Out of stock!</p>
                    ) : (
                      <p className="text-green-500 text-xs mt-1">
                        Available: {prepared.toFixed(2)}
                      </p>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Shopping Cart */}
      <div className="lg:col-span-1">
        <div className="bg-white shadow rounded-lg p-6 sticky top-4">
          <h2 className="text-lg font-medium mb-4">Current Order</h2>

          {cart.length === 0 ? (
            <p className="text-gray-500 text-center py-6">
              Cart is empty. Add products from the left.
            </p>
          ) : (
            <>
              <ul className="divide-y divide-gray-200">
                {cart.map((item) => (
                  <li key={item.product._id} className="py-3">
                    {" "}
                    {/* Change from id to _id */}
                    <div className="flex justify-between">
                      <span className="font-medium">{item.product.name}</span>
                      <button
                        onClick={() => handleRemoveFromCart(item.product._id)} // Change from id to _id
                        className="text-red-500 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <div className="flex items-center">
                        <button
                          onClick={() =>
                            handleUpdateQuantity(
                              item.product._id, // Change from id to _id
                              item.quantity - 1
                            )
                          }
                          className="bg-gray-200 px-2 py-1 rounded"
                        >
                          -
                        </button>
                        <span className="mx-2">{item.quantity}</span>
                        <button
                          onClick={() =>
                            handleUpdateQuantity(
                              item.product._id, // Change from id to _id
                              item.quantity + 1
                            )
                          }
                          className="bg-gray-200 px-2 py-1 rounded"
                        >
                          +
                        </button>
                      </div>
                      <span className="font-medium">
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="border-t pt-4 mt-4">
                <div className="flex justify-between font-bold text-lg">
                  <span>Total:</span>
                  <span>{formatCurrency(calculateTotal())}</span>
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={processing || cart.length === 0}
                  className="w-full mt-4 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {processing ? "Processing..." : "Complete Sale"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PointOfSale;
