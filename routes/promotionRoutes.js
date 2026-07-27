const express = require("express");
const router = express.Router();
const promoController = require("../controllers/promotionController");
const { verifyToken, requireRole } = require("../middlewares/auth");
// ============================================================
// CUSTOMER-FACING (existing)
// ============================================================
// GET  /api/promotions        -> list all promotions
// POST /api/promotions/redeem -> redeem a promo code
router.get("/", promoController.getPromotions);
router.post("/redeem", verifyToken, promoController.redeemPromotion);
// ============================================================
// STALLHOLDER-FACING (new)
// All require a valid JWT cookie AND the "storeholder" role, and are
// scoped in the controller to the owner's own stall.
// ============================================================
// GET    /api/promotions/mine    -> this stall's promotions
// POST   /api/promotions         -> create a promotion
// PUT    /api/promotions/:id     -> update a promotion
// DELETE /api/promotions/:id     -> delete a promotion
router.get(
  "/mine",
  verifyToken,
  requireRole("storeholder"),
  promoController.getMyPromotions,
);
router.post(
  "/",
  verifyToken,
  requireRole("storeholder"),
  promoController.createPromotion,
);
router.put(
  "/:id",
  verifyToken,
  requireRole("storeholder"),
  promoController.updatePromotion,
);
router.delete(
  "/:id",
  verifyToken,
  requireRole("storeholder"),
  promoController.deletePromotion,
);
module.exports = router;