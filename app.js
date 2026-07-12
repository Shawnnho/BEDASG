require("dotenv").config();
const express = require("express");
const path = require("path");
const sql = require("mssql");
const dbConfig = require("./dbConfig");
const cookieParser = require("cookie-parser");

// Route imports
const stallRoutes = require("./routes/stallRoutes");
const centreRoutes = require("./routes/centreRoutes");
const faqRoutes = require("./routes/faqRoutes");
const contactRoutes = require("./routes/contactRoutes");
const promotionRoutes = require("./routes/promotionRoutes");
const authRoutes = require("./routes/authRoutes");
const favStallRoutes = require("./routes/favStallRoutes");
const hygieneRoutes = require("./routes/hygieneRoutes");
const cartRoutes = require("./routes/cartRoutes");
const orderRoutes = require("./routes/orderRoutes");
const stallMenuRoutes = require("./routes/stallMenuRoutes");
const stallAccountRoutes = require("./routes/stallAccountRoutes");

const complaintRoutes = require("./routes/complaintRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const checkoutCardRoutes = require("./routes/checkoutCardRoutes");
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON request bodies (needed later for POST/PUT)
app.use(express.json({ limit: "10mb" }));

// Without this, every req.cookies?.accessToken read is silently undefined, and login/refreshwould appear to just not work at all.

app.use(cookieParser());

// Serve the front-end (put your html/css/js in the /public folder)
app.use(express.static(path.join(__dirname, "public")));
// API routes
app.use("/api/stalls", stallRoutes);
app.use("/api/centres", centreRoutes);
app.use("/api/faqs", require("./routes/faqRoutes"));
app.use("/api/contact", contactRoutes);
app.use("/api/promotions", promotionRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/favstalls", favStallRoutes);
app.use("/api/hygiene", hygieneRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/stall", orderRoutes);
app.use("/api/stall", stallMenuRoutes);

app.use("/api/complaints", complaintRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/checkoutCard", checkoutCardRoutes);

app.use("/api/stall", orderRoutes);
app.use("/api/stall", stallMenuRoutes);
app.use("/api/stall", stallAccountRoutes); // add this

// Health check route — confirms the server + DB are alive
app.get("/api/health", async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request().query("SELECT GETDATE() AS now");
    res.json({
      status: "ok",
      dbTime: result.recordset[0].now,
    });
  } catch (err) {
    console.error("Health check failed:", err.message);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
