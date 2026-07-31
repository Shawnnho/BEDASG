const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { validateRegister, validateLogin } = require("../middlewares/validation");
const { verifyToken } = require("../middlewares/auth");

router.post("/register", validateRegister, (req, res) => {
  // #swagger.tags = ['Authentication']
  // #swagger.summary = 'Register a new user (customer, stall-holder, or operator)'
  authController.register(req, res);
});

router.post("/login", validateLogin, (req, res) => {
  // #swagger.tags = ['Authentication']
  // #swagger.summary = 'Log in and receive access/refresh token cookies'
  authController.login(req, res);
});

router.post("/refresh", (req, res) => {
  // #swagger.tags = ['Authentication']
  // #swagger.summary = 'Issue a new access token using the refresh cookie'
  authController.refresh(req, res);
});

router.post("/logout", (req, res) => {
  // #swagger.tags = ['Authentication']
  // #swagger.summary = 'Clear auth cookies and end the session'
  authController.logout(req, res);
});

router.get("/me", verifyToken, (req, res) => {
  // #swagger.tags = ['Authentication']
  // #swagger.summary = 'Get the currently authenticated user'
  authController.me(req, res);
});

module.exports = router;