const express = require("express");
const router = express.Router();
const faqController = require("../controllers/faqController");
const { verifyToken, requireRole } = require("../middlewares/auth");

// FAQs are publicly readable (help.html).
router.get("/", faqController.getAllFaqs);
router.get("/:id", faqController.getFaqById);

// Managing FAQ content is admin-only.
router.post("/", verifyToken, requireRole("operator"), faqController.createFaq);
router.put("/:id", verifyToken, requireRole("operator"), faqController.updateFaq);
router.delete("/:id", verifyToken, requireRole("operator"), faqController.deleteFaq);

module.exports = router;
