const express = require("express");
const router = express.Router();
const promoController = require("../controllers/promotionController");
const { verifyToken, requireRole } = require("../middlewares/auth");

// ============================================================
// IMPORTANT: Express matches routes top-to-bottom. Specific/literal
// paths (like "/mine", "/redeem", "/count/:userId") MUST be declared
// BEFORE the dynamic "/:userId" catch-all, otherwise a request to
// /api/promotions/mine gets captured by /:userId (userId = "mine")
// and the wrong handler runs.
// ============================================================

// ------------------------------------------------------------
// STALLHOLDER-FACING (specific paths first)
// All require a valid JWT cookie AND the "storeholder" role, and are
// scoped in the controller to the owner's own stall.
// ------------------------------------------------------------
// GET    /api/promotions/mine    -> this stall's promotions
// POST   /api/promotions         -> create a promotion
// PUT    /api/promotions/:id     -> update a promotion
// DELETE /api/promotions/:id     -> delete a promotion
router.get("/mine", verifyToken, requireRole("storeholder"), (req, res) => {
  // #swagger.tags = ['Stall Promotions']
  // #swagger.summary = "List the promotions created by the owner's stall"
  promoController.getMyPromotions(req, res);
});

// ------------------------------------------------------------
// CUSTOMER-FACING
// ------------------------------------------------------------
// GET  /api/promotions            -> list all promotions
// POST /api/promotions/redeem     -> redeem a promo code
// GET  /api/promotions/count/:id  -> count of claimed promotions
// GET  /api/promotions/:userId    -> list claimed promotions by a user
router.get("/", (req, res) => {
  // #swagger.tags = ['Promotions (Customer)']
  // #swagger.summary = 'List all promotions'
  promoController.getPromotions(req, res);
});

router.post("/redeem", verifyToken, (req, res) => {
  // #swagger.tags = ['Promotions (Customer)']
  // #swagger.summary = 'Redeem a promo code'
  promoController.redeemPromotion(req, res);
});

router.get("/count/:userId", (req, res) => {
  // #swagger.tags = ['Promotions (Customer)']
  // #swagger.summary = 'Count of claimed promotions for a user'
  promoController.getPromotionCountByUserId(req, res);
});

// Dynamic catch-all params LAST so they don't shadow literal paths above.
router.get("/:userId", (req, res) => {
  // #swagger.tags = ['Promotions (Customer)']
  // #swagger.summary = 'List claimed promotions for a user'
  promoController.getPromotionsByUserId(req, res);
});

// POST/PUT/DELETE for stallholder CRUD. POST "/" is unambiguous;
// PUT/DELETE "/:id" don't collide with any literal GET paths above.
router.post("/", verifyToken, requireRole("storeholder"), (req, res) => {
  // #swagger.tags = ['Stall Promotions']
  // #swagger.summary = 'Create a promotion'
  promoController.createPromotion(req, res);
});

router.put("/:id", verifyToken, requireRole("storeholder"), (req, res) => {
  // #swagger.tags = ['Stall Promotions']
  // #swagger.summary = 'Edit a promotion'
  promoController.updatePromotion(req, res);
});

router.delete("/:id", verifyToken, requireRole("storeholder"), (req, res) => {
  // #swagger.tags = ['Stall Promotions']
  // #swagger.summary = 'Delete a promotion'
  promoController.deletePromotion(req, res);
});

module.exports = router;
