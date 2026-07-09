const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { validateRegister, validateLogin } = require("../middlewares/validation");
const { verifyToken } = require("../middlewares/auth");

router.post("/register", validateRegister, authController.register);
router.post("/login", validateLogin, authController.login);
router.post("/refresh", authController.refresh); // reads refreshToken cookie itself — no verifyToken needed
router.post("/logout", authController.logout); // reads refreshToken cookie itself — works even if access token already expired
router.get("/me", verifyToken, authController.me);

module.exports = router;
