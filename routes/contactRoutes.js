const express = require("express");
const router = express.Router();
const contactController = require("../controllers/contactController");

router.get("/", contactController.getAllMessages);
router.get("/:id", contactController.getMessageById);
router.post("/", contactController.createMessage);
router.put("/:id/status", contactController.updateStatus);
router.delete("/:id", contactController.deleteMessage);

module.exports = router;
