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
    { name: "Complaints", description: "Submit, view, edit, and delete complaints against a stall" },
    { name: "Reviews", description: "Submit, view, edit, and delete stall reviews and ratings" },
    { name: "Comments", description: "Comment on reviews" },
    { name: "Reports", description: "Report a review as spam, fake, or inappropriate" },
    { name: "Operator", description: "Centre/stall management, rental agreements, billing, and report moderation" },
  ],
};

swaggerAutogen(outputFile, routes, doc);