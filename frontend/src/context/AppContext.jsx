import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
} from "react";
import * as api from "../api/api";

const AppContext = createContext();

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
};

export const AppProvider = ({ children }) => {
  // Core data states
  const [ingredients, setIngredients] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);

  // Loading and error states
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  // Individual loading states for better UX
  const [loadingStates, setLoadingStates] = useState({
    ingredients: false,
    recipes: false,
    products: false,
    sales: false,
    dashboard: false,
  });

  // Set individual loading state
  const setLoadingState = useCallback((key, isLoading) => {
    setLoadingStates((prev) => ({ ...prev, [key]: isLoading }));
  }, []);

  // Fetch ingredients with error handling
  const fetchIngredients = useCallback(async () => {
    try {
      setLoadingState("ingredients", true);
      const { data } = await api.getIngredients();
      setIngredients(data || []);
    } catch (err) {
      console.error("Failed to fetch ingredients:", err);
      const errorInfo = api.handleApiError(err);
      throw new Error(`Ingredients: ${errorInfo.message}`);
    } finally {
      setLoadingState("ingredients", false);
    }
  }, [setLoadingState]);

  // Fetch recipes with error handling
  const fetchRecipes = useCallback(async () => {
    try {
      setLoadingState("recipes", true);
      const { data } = await api.getRecipes();
      setRecipes(data || []);
    } catch (err) {
      console.error("Failed to fetch recipes:", err);
      const errorInfo = api.handleApiError(err);
      throw new Error(`Recipes: ${errorInfo.message}`);
    } finally {
      setLoadingState("recipes", false);
    }
  }, [setLoadingState]);

  // Fetch products with error handling
  const fetchProducts = useCallback(async () => {
    try {
      setLoadingState("products", true);
      const { data } = await api.getProducts();
      console.log(
        "Raw products from API:",
        data?.map((p) => ({
          name: p.name,
          prepared_quantity: p.prepared_quantity,
          price: p.price,
          cost: p.cost,
          profit_margin: p.profit_margin,
        }))
      );
      setProducts(data || []);
    } catch (err) {
      console.error("Failed to fetch products:", err);
      const errorInfo = api.handleApiError(err);
      throw new Error(`Products: ${errorInfo.message}`);
    } finally {
      setLoadingState("products", false);
    }
  }, [setLoadingState]);

  // Fetch sales with optional parameters
  const fetchSales = useCallback(
    async (params = {}) => {
      try {
        setLoadingState("sales", true);
        const { data } = await api.getSales(params);
        setSales(data || []);
      } catch (err) {
        console.error("Failed to fetch sales:", err);
        const errorInfo = api.handleApiError(err);
        throw new Error(`Sales: ${errorInfo.message}`);
      } finally {
        setLoadingState("sales", false);
      }
    },
    [setLoadingState]
  );

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoadingState("dashboard", true);
      const { data } = await api.getDashboardData();
      setDashboardData(data);
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
      const errorInfo = api.handleApiError(err);
      throw new Error(`Dashboard: ${errorInfo.message}`);
    } finally {
      setLoadingState("dashboard", false);
    }
  }, [setLoadingState]);

  // Refresh all data
  const refreshData = useCallback(
    async (options = {}) => {
      try {
        setLoading(true);
        setError(null);

        const promises = [];

        if (options.ingredients !== false) promises.push(fetchIngredients());
        if (options.recipes !== false) promises.push(fetchRecipes());
        if (options.products !== false) promises.push(fetchProducts());
        if (options.sales !== false) promises.push(fetchSales());
        if (options.dashboard !== false) promises.push(fetchDashboardData());

        await Promise.all(promises);
        setLoaded(true);
      } catch (err) {
        const errorMessage = err.message || "Failed to refresh data";
        setError(errorMessage);
        console.error("Data refresh error:", err);
        setLoaded(false);
      } finally {
        setLoading(false);
      }
    },
    [
      fetchIngredients,
      fetchRecipes,
      fetchProducts,
      fetchSales,
      fetchDashboardData,
    ]
  );

  // Refresh specific data type
  const refreshSpecific = useCallback(
    async (dataType) => {
      try {
        setError(null);

        switch (dataType) {
          case "ingredients":
            await fetchIngredients();
            break;
          case "recipes":
            await fetchRecipes();
            break;
          case "products":
            await fetchProducts();
            break;
          case "sales":
            await fetchSales();
            break;
          case "dashboard":
            await fetchDashboardData();
            break;
          default:
            throw new Error(`Unknown data type: ${dataType}`);
        }
      } catch (err) {
        const errorMessage = err.message || `Failed to refresh ${dataType}`;
        setError(errorMessage);
        console.error(`Refresh ${dataType} error:`, err);
      }
    },
    [
      fetchIngredients,
      fetchRecipes,
      fetchProducts,
      fetchSales,
      fetchDashboardData,
    ]
  );

  // CRUD operations for ingredients
  const ingredientOperations = {
    create: async (data) => {
      try {
        const response = await api.createIngredient(data);
        await fetchIngredients(); // Refresh ingredients
        return response.data;
      } catch (err) {
        const errorInfo = api.handleApiError(err);
        throw new Error(errorInfo.message);
      }
    },
    update: async (id, data) => {
      try {
        const response = await api.updateIngredient(id, data);
        await fetchIngredients(); // Refresh ingredients
        return response.data;
      } catch (err) {
        const errorInfo = api.handleApiError(err);
        throw new Error(errorInfo.message);
      }
    },
    delete: async (id) => {
      try {
        await api.deleteIngredient(id);
        await fetchIngredients(); // Refresh ingredients
      } catch (err) {
        const errorInfo = api.handleApiError(err);
        throw new Error(errorInfo.message);
      }
    },
    restock: async (id, amount) => {
      try {
        const response = await api.restockIngredient(id, amount);
        await fetchIngredients(); // Refresh ingredients
        return response.data;
      } catch (err) {
        const errorInfo = api.handleApiError(err);
        throw new Error(errorInfo.message);
      }
    },
  };

  // CRUD operations for recipes
  const recipeOperations = {
    create: async (data) => {
      try {
        const response = await api.createRecipe(data);
        await fetchRecipes(); // Refresh recipes
        return response.data;
      } catch (err) {
        const errorInfo = api.handleApiError(err);
        throw new Error(errorInfo.message);
      }
    },
    update: async (id, data) => {
      try {
        const response = await api.updateRecipe(id, data);
        await fetchRecipes(); // Refresh recipes
        return response.data;
      } catch (err) {
        const errorInfo = api.handleApiError(err);
        throw new Error(errorInfo.message);
      }
    },
    delete: async (id) => {
      try {
        await api.deleteRecipe(id);
        await fetchRecipes(); // Refresh recipes
      } catch (err) {
        const errorInfo = api.handleApiError(err);
        throw new Error(errorInfo.message);
      }
    },
    prepare: async (id, quantity, notes) => {
      try {
        const response = await api.prepareRecipe(id, quantity, notes);
        // Refresh both recipes and products as preparation affects both
        await Promise.all([
          fetchRecipes(),
          fetchProducts(),
          fetchIngredients(),
        ]);
        return response.data;
      } catch (err) {
        const errorInfo = api.handleApiError(err);
        throw new Error(errorInfo.message);
      }
    },
  };

  // CRUD operations for products
  const productOperations = {
    create: async (data) => {
      try {
        const response = await api.createProduct(data);
        await fetchProducts(); // Refresh products
        return response.data;
      } catch (err) {
        const errorInfo = api.handleApiError(err);
        throw new Error(errorInfo.message);
      }
    },
    update: async (id, data) => {
      try {
        const response = await api.updateProduct(id, data);
        await fetchProducts(); // Refresh products
        return response.data;
      } catch (err) {
        const errorInfo = api.handleApiError(err);
        throw new Error(errorInfo.message);
      }
    },
    delete: async (id) => {
      try {
        await api.deleteProduct(id);
        await fetchProducts(); // Refresh products
      } catch (err) {
        const errorInfo = api.handleApiError(err);
        throw new Error(errorInfo.message);
      }
    },
  };

  // CRUD operations for sales
  const saleOperations = {
    create: async (data) => {
      try {
        const response = await api.createSale(data);
        // Refresh sales, products, and dashboard as sales affect multiple areas
        await Promise.all([
          fetchSales(),
          fetchProducts(),
          fetchDashboardData(),
        ]);
        return response.data;
      } catch (err) {
        const errorInfo = api.handleApiError(err);
        throw new Error(errorInfo.message);
      }
    },
    update: async (id, data) => {
      try {
        const response = await api.updateSale(id, data);
        await Promise.all([fetchSales(), fetchDashboardData()]);
        return response.data;
      } catch (err) {
        const errorInfo = api.handleApiError(err);
        throw new Error(errorInfo.message);
      }
    },
    delete: async (id) => {
      try {
        await api.deleteSale(id);
        await Promise.all([fetchSales(), fetchDashboardData()]);
      } catch (err) {
        const errorInfo = api.handleApiError(err);
        throw new Error(errorInfo.message);
      }
    },
  };

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Get filtered/sorted data
  const getFilteredIngredients = useCallback(
    (searchTerm = "", sortBy = "name") => {
      let filtered = ingredients;

      if (searchTerm) {
        filtered = filtered.filter(
          (ingredient) =>
            ingredient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ingredient.category
              ?.toLowerCase()
              .includes(searchTerm.toLowerCase())
        );
      }

      return filtered.sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name);
        if (sortBy === "quantity") return b.quantity - a.quantity;
        if (sortBy === "category")
          return (a.category || "").localeCompare(b.category || "");
        return 0;
      });
    },
    [ingredients]
  );

  const getLowStockIngredients = useCallback(
    (threshold = 10) => {
      return ingredients.filter(
        (ingredient) => ingredient.quantity <= threshold
      );
    },
    [ingredients]
  );

  // Initial data load
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Check if any loading is happening
  const isAnyLoading = loading || Object.values(loadingStates).some(Boolean);

  const value = {
    // Data
    ingredients,
    recipes,
    products,
    sales,
    dashboardData,

    // States
    loading,
    loaded,
    error,
    loadingStates,
    isAnyLoading,

    // Actions
    refreshData,
    refreshSpecific,
    clearError,

    // CRUD operations
    ingredientOperations,
    recipeOperations,
    productOperations,
    saleOperations,

    // Utility functions
    getFilteredIngredients,
    getLowStockIngredients,

    // Individual fetch functions (in case components need them)
    fetchIngredients,
    fetchRecipes,
    fetchProducts,
    fetchSales,
    fetchDashboardData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
