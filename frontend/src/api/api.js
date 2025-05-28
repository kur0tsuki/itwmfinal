import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000, // 10 second timeout
});

// Request interceptor for logging
API.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error("API Request Error:", error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
API.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API Response Error:", error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Ingredients API
export const getIngredients = () => API.get("/ingredients");
export const getIngredient = (id) => API.get(`/ingredients/${id}`); // Remove trailing slash
export const createIngredient = (data) => {
  console.log("Creating ingredient with data:", data);
  return API.post("/ingredients", data);
};
export const updateIngredient = (id, data) => {
  console.log("Updating ingredient with data:", { id, data });
  return API.put(`/ingredients/${id}`, data);
};
export const deleteIngredient = (id) => API.delete(`/ingredients/${id}`);
export const restockIngredient = (id, amount) =>
  API.post(`/ingredients/${id}/restock`, { amount: parseFloat(amount) });

// Recipes API
export const getRecipes = () => API.get("/recipes");
export const getRecipe = (id) => API.get(`/recipes/${id}`); // Removed trailing slash
export const createRecipe = (data) => API.post("/recipes", data);
export const updateRecipe = (id, data) => API.put(`/recipes/${id}`, data);
export const deleteRecipe = (id) => API.delete(`/recipes/${id}`);
export const prepareRecipe = (id, quantity) =>
  API.post(`/recipes/${id}/prepare`, {
    quantity: parseFloat(quantity),
  });

// Products API
export const getProducts = () => API.get("/products");
export const getProduct = (id) => API.get(`/products/${id}`); // Remove any trailing slashes
export const createProduct = (data) => API.post("/products", data);
export const updateProduct = (id, data) => API.put(`/products/${id}`, data);
export const deleteProduct = (id) => API.delete(`/products/${id}`);

// Sales API
export const getSales = (params = {}) => {
  const queryParams = new URLSearchParams();

  if (params.page) queryParams.append("page", params.page);
  if (params.limit) queryParams.append("limit", params.limit);
  if (params.start_date) queryParams.append("start_date", params.start_date);
  if (params.end_date) queryParams.append("end_date", params.end_date);
  if (params.product_id) queryParams.append("product_id", params.product_id);

  const queryString = queryParams.toString();
  return API.get(`/sales/${queryString ? "?" + queryString : ""}`);
};

export const getSale = (id) => API.get(`/sales/${id}/`);

export const createSale = (data) =>
  API.post("/sales", {
    product: data.product,
    quantity: data.quantity,
    unitPrice: data.unitPrice, // Match backend schema naming
  });

export const updateSale = (id, data) => API.put(`/sales/${id}/`, data);
export const deleteSale = (id) => API.delete(`/sales/${id}/`);

export const getSaleReport = (period = "day", startDate, endDate) => {
  if (!startDate || !endDate) {
    throw new Error("Start date and end date are required for reports");
  }

  const params = new URLSearchParams({
    period,
    start_date: startDate,
    end_date: endDate,
  });
  return API.get(`/sales/report/?${params.toString()}`);
};

export const getDashboardData = () => API.get("/sales/dashboard/");

// Production Records API (if you want to track recipe preparations)
export const getProductionRecords = (params = {}) => {
  const queryParams = new URLSearchParams();

  if (params.recipe_id) queryParams.append("recipe_id", params.recipe_id);
  if (params.start_date) queryParams.append("start_date", params.start_date);
  if (params.end_date) queryParams.append("end_date", params.end_date);

  const queryString = queryParams.toString();
  return API.get(`/production-records/${queryString ? "?" + queryString : ""}`);
};

// RecipeIngredients API
export const getRecipeIngredients = (recipeId = null) => {
  if (recipeId) {
    return API.get(`/recipe-ingredients/?recipe=${recipeId}`);
  }
  return API.get("/recipe-ingredients/");
};

export const getRecipeIngredient = (id) =>
  API.get(`/recipe-ingredients/${id}/`);

export const createRecipeIngredient = (data) => {
  // Validate required fields
  if (!data.recipe || !data.ingredient || !data.quantity) {
    throw new Error("Recipe, ingredient, and quantity are required");
  }

  return API.post("/recipe-ingredients/", {
    recipe: data.recipe,
    ingredient: data.ingredient,
    quantity: parseFloat(data.quantity),
    unit: data.unit || "g",
  });
};

export const updateRecipeIngredient = (id, data) =>
  API.put(`/recipe-ingredients/${id}/`, {
    ...data,
    quantity: data.quantity ? parseFloat(data.quantity) : undefined,
  });

export const deleteRecipeIngredient = (id) =>
  API.delete(`/recipe-ingredients/${id}/`);

// Utility functions for error handling
export const handleApiError = (error) => {
  if (error.response) {
    // Server responded with error status
    const { status, data } = error.response;
    const message = data?.error || data?.message || `Server error (${status})`;
    return { success: false, message, status };
  } else if (error.request) {
    // Request was made but no response received
    return {
      success: false,
      message: "Network error - please check your connection",
      status: 0,
    };
  } else {
    // Something else happened
    return {
      success: false,
      message: error.message || "An unexpected error occurred",
      status: 0,
    };
  }
};

// Batch operations
export const batchUpdateIngredients = (updates) => {
  return API.post("/ingredients/batch-update/", { updates });
};

export const batchCreateRecipeIngredients = (recipeId, ingredients) => {
  return API.post(`/recipes/${recipeId}/ingredients/batch/`, { ingredients });
};

// Analytics endpoints
export const getIngredientUsage = (ingredientId, days = 30) => {
  return API.get(`/ingredients/${ingredientId}/usage/?days=${days}`);
};

export const getTopSellingProducts = (days = 30, limit = 10) => {
  return API.get(`/products/top-selling/?days=${days}&limit=${limit}`);
};

export const getProfitAnalysis = (startDate, endDate) => {
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
  });
  return API.get(`/sales/profit-analysis/?${params.toString()}`);
};

export default API;
