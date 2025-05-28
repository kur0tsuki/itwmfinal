const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Database connection
mongoose.connect(
  process.env.MONGODB_URI || "mongodb://localhost:27017/restaurant",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

// Routes
app.use("/api/ingredients", require("./routes/ingredients"));
app.use("/api/recipes", require("./routes/recipes"));
app.use("/api/products", require("./routes/products"));
app.use("/api/sales", require("./routes/sales"));

// Error handling middleware
app.use((error, req, res, next) => {
  const status = error.statusCode || 500;
  const message = error.message;
  res.status(status).json({ error: message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
