const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { validateRegister, validateLogin } = require("../middlewares/validation");
const { verifyToken } = require("../middlewares/auth");

router.post("/register", validateRegister, authController.register);
/*  #swagger.tags = ['Authentication']
    #swagger.summary = 'Register a new user (customer, stall-holder, or operator)' */

router.post("/login", validateLogin, authController.login);
/*  #swagger.tags = ['Authentication']
    #swagger.summary = 'Log in and receive access/refresh token cookies' */

router.post("/refresh", authController.refresh); // reads refreshToken cookie itself — no verifyToken needed
/*  #swagger.tags = ['Authentication']
    #swagger.summary = 'Issue a new access token using the refresh cookie' */

router.post("/logout", authController.logout); // reads refreshToken cookie itself — works even if access token already expired
/*  #swagger.tags = ['Authentication']
    #swagger.summary = 'Clear auth cookies and end the session' */

router.get("/me", verifyToken, authController.me);
/*  #swagger.tags = ['Authentication']
    #swagger.summary = 'Get the currently authenticated user' */

module.exports = router;