const swaggerAutogen = require("swagger-autogen")();

const outputFile = "./swagger-output.json"; // Output file for the spec
const routes = ["./app.js"]; // Path to your API route files

const doc = {
  info: {
    title: "HawkerPoint API",
    description: "Description of your API",
  },
  host: "localhost:3000",
  tags: [
    // ----- Feedback / Operator (teammates) -----
    {
      name: "Complaints",
      description: "Submit, view, edit, and delete complaints against a stall",
    },
    {
      name: "Reviews",
      description: "Submit, view, edit, and delete stall reviews and ratings",
    },
    { name: "Comments", description: "Comment on reviews" },
    {
      name: "Reports",
      description: "Report a review as spam, fake, or inappropriate",
    },
    {
      name: "Operator",
      description:
        "Centre/stall management, rental agreements, billing, and report moderation",
    },
    // ----- Stall-holder (Shawn) -----
    {
      name: "Stall Dashboard",
      description: "Stall owner dashboard summary (orders, sales, rating)",
    },
    {
      name: "Stall Orders",
      description: "View and update incoming orders for the stall",
    },
    {
      name: "Stall Menu",
      description: "Manage menu items, variant pricing, and add-ons",
    },
    {
      name: "Stall Analytics",
      description: "Sales analytics: KPIs, time series, and top dishes",
    },
    {
      name: "Stall Promotions",
      description: "Create, edit, and delete the stall's promotions",
    },
    {
      name: "Stall Reviews",
      description: "Read the stall's reviews and per-item ratings",
    },
    {
      name: "Stall Closures",
      description: "Schedule closed days (with SG public holiday suggestions)",
    },
    {
      name: "Stall Account",
      description: "Owner profile, stall settings, hours, and account",
    },
    {
      name: "Rental Bill",
      description: "View and pay the stall's monthly rental bill",
    },
    {
      name: "Manage Payments",
      description: "Operator bill summary and payments",
    },
        // ----- Auth / NEA (Jovan) -----
    {
      name: "Authentication",
      description:
        "Signup, login, token/cookie session management, and auth checks",
    },
    {
      name: "Hygiene Grade",
      description:
        "View hygiene grades — customer, stall-holder, and NEA inspector perspectives",
    },
    {
      name: "Hygiene Inspections",
      description: "Schedule, complete, and cancel NEA hygiene inspections",
    },
    {
      name: "Manage Complaints",
      description: "NEA officer review and status updates on complaints",
    },
  ],
};

swaggerAutogen(outputFile, routes, doc);
