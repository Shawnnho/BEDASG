const express = require("express");
const router = express.Router();
const contactController = require("../controllers/contactController");
const { verifyToken, requireRole } = require("../middlewares/auth");

// Anyone can submit the contact form.
router.post("/", contactController.createMessage);

// Everything else is admin-only inbox management.
router.get("/", verifyToken, requireRole("operator"), contactController.getAllMessages);
router.get("/:id", verifyToken, requireRole("operator"), contactController.getMessageById);
router.put("/:id/status", verifyToken, requireRole("operator"), contactController.updateStatus);
router.delete("/:id", verifyToken, requireRole("operator"), contactController.deleteMessage);

module.exports = router;
