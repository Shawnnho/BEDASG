require("dotenv").config();
const express = require("express");
const path = require("path");
const { poolPromise } = require("./dbConfig");
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
const menuRoutes = require("./routes/menuRoutes");
const stallMenuRoutes = require("./routes/stallMenuRoutes");
const stallAccountRoutes = require("./routes/stallAccountRoutes");
const neaRoutes = require("./routes/neaRoutes");
const complaintRoutes = require("./routes/complaintRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const checkoutCardRoutes = require("./routes/checkoutCardRoutes");
const operatorRoutes = require("./routes/operatorRoutes");
const customerOrdersRoutes = require("./routes/customerOrdersRoutes");
const addonRoutes = require("./routes/addonRoutes");
const stallAnalyticsRoutes = require("./routes/stallAnalyticsRoutes");
const reportRoutes = require("./routes/reportRoutes");
const commentRoutes = require("./routes/commentRoutes");
const rentalRoutes = require("./routes/rentalRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const favItemRoutes = require("./routes/favItemRoutes");
const favouriteOrderRoutes = require("./routes/favouriteOrderRoutes");
const menuPricesRoutes = require("./routes/menuPricesRoutes");
const stallClosureRoutes = require("./routes/stallClosureRoutes");

const app = express();
const PORT = process.env.PORT || 3000;
// Middleware to parse JSON request bodies (needed later for POST/PUT)
app.use(express.json({ limit: "10mb" }));
// Without this, every req.cookies?.accessToken read is silently undefined, and login/refresh would appear to just not work at all.
app.use(cookieParser());
// Serve the front-end (put your html/css/js in the /public folder)
app.use(express.static(path.join(__dirname, "public")));
// API routes
app.use("/api/stalls", stallRoutes);
app.use("/api/centres", centreRoutes);
app.use("/api/faqs", faqRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/promotions", promotionRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/favstalls", favStallRoutes);
app.use("/api/hygiene", hygieneRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/operator", operatorRoutes);
app.use("/api/nea", neaRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/checkoutCard", checkoutCardRoutes);
app.use("/api/orders", customerOrdersRoutes);
app.use("/api/addons", addonRoutes); // This is for stall order management, not customer orders
app.use("/api/stall", stallAnalyticsRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/rental", rentalRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/favitems", favItemRoutes);
// Stall-specific routes
app.use("/api/stall", orderRoutes);
app.use("/api/stall", stallMenuRoutes);
app.use("/api/stall", stallAccountRoutes);
app.use("/api/favourites", favouriteOrderRoutes);
app.use("/api/menuprices", menuPricesRoutes);
app.use("/api/stall/closures", stallClosureRoutes);

// Health check route — confirms the server + DB are alive
app.get("/api/health", async (req, res) => {
  try {
    const pool = await poolPromise;
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
