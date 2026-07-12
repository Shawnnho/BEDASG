const bcrypt = require("bcrypt");
const accountModel = require("../models/stallAccountModel");

const SALT_ROUNDS = 10;

/* ===== helpers ===== */

function getUserId(req, res) {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return userId;
}

// SG mobile: starts 8 or 9, 8 digits total
function isPhone(v) {
  return /^[89]\d{7}$/.test(String(v || "").trim());
}

// "01-4" / "#01-04" / "01-004" -> "01-04"
function normalizeUnit(v) {
  const raw = String(v || "").trim();
  if (!raw) return "";
  const m = raw.match(/^#?(\d{2})-(\d{1,3})$/);
  if (!m) return null;
  const n = parseInt(m[2], 10);
  if (!Number.isFinite(n)) return null;
  return `${m[1]}-${String(n).padStart(2, "0")}`;
}

function num(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

/* ===== GET /api/stall/account ===== */

async function getAccount(req, res) {
  try {
    const userId = getUserId(req, res);
    if (!userId) return;

    const row = await accountModel.getAccount(userId);
    if (!row) return res.status(404).json({ error: "Account not found" });

    const hours = row.StallId
      ? await accountModel.getStallHours(row.StallId)
      : [];

    res.json({
      profile: {
        userId: row.UserId,
        name: row.Name || "",
        email: row.Email || "",
        phone: row.Phone || "",
        avatarUrl: row.AvatarUrl || "",
        role: row.UserRole || "",
        isDeactivated: !!row.IsDeactivated,
      },
      notifPrefs: {
        newOrders: !!row.NotifNewOrders,
        orderUpdates: !!row.NotifOrderUpdates,
        newReview: !!row.NotifNewReview,
        hygiene: !!row.NotifHygiene,
      },
      stall: row.StallId
        ? {
            stallId: row.StallId,
            stallName: row.StallName || "",
            cuisine: row.Cuisine || "",
            desc: row.Desc || "",
            imageUrl: row.ImageUrl || "",
            unitNo: row.UnitNo || "",
            phone: row.StallPhone || "",
            hygieneGrade: row.HygieneGrade || "",
            prepMin: row.PrepMin,
            prepMax: row.PrepMax,
            isActive: !!row.IsActive,
            supportsAddons: !!row.SupportsAddons,
            supportsSizePricing: !!row.SupportsSizePricing,
            rating:
              row.RatingCount > 0
                ? Number((row.RatingTotal / row.RatingCount).toFixed(1))
                : null,
            ratingCount: row.RatingCount ?? 0,
          }
        : null,
      hours: hours.map((h) => ({
        dayOfWeek: h.DayOfWeek,
        isClosed: !!h.IsClosed,
        openTime: h.OpenTime || "",
        closeTime: h.CloseTime || "",
      })),
    });
  } catch (err) {
    console.error("getAccount error:", err);
    res.status(500).json({ error: "Failed to load account" });
  }
}

/* ===== PATCH /api/stall/account/profile ===== */

async function updateProfile(req, res) {
  try {
    const userId = getUserId(req, res);
    if (!userId) return;

    const { name, phone, avatarUrl } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Name is required" });
    }
    if (phone && !isPhone(phone)) {
      return res.status(400).json({ error: "Invalid SG phone number" });
    }

    await accountModel.updateProfile(userId, {
      name: String(name).trim(),
      phone: phone ? String(phone).trim() : null,
      avatarUrl: avatarUrl || null, // only overwritten if supplied
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("updateProfile error:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
}

/* ===== PATCH /api/stall/account/notifications ===== */

async function updateNotifPrefs(req, res) {
  try {
    const userId = getUserId(req, res);
    if (!userId) return;

    const { newOrders, orderUpdates, newReview, hygiene } = req.body;

    await accountModel.updateNotifPrefs(userId, {
      newOrders,
      orderUpdates,
      newReview,
      hygiene,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("updateNotifPrefs error:", err);
    res.status(500).json({ error: "Failed to save preferences" });
  }
}

/* ===== PATCH /api/stall/account/stall ===== */

async function updateStall(req, res) {
  try {
    const userId = getUserId(req, res);
    if (!userId) return;

    const acct = await accountModel.getAccount(userId);
    if (!acct?.StallId) {
      return res.status(404).json({ error: "No stall linked to this user" });
    }

    const {
      stallName,
      cuisine,
      desc,
      unitNo,
      phone,
      prepMin,
      prepMax,
      imageUrl,
      supportsAddons,
      supportsSizePricing,
      hours,
    } = req.body;

    if (!stallName || !String(stallName).trim()) {
      return res.status(400).json({ error: "Stall name is required" });
    }

    const unit = normalizeUnit(unitNo);
    if (unit === null) {
      return res
        .status(400)
        .json({ error: "Invalid unit number (expected e.g. 01-04)" });
    }

    const pMin = num(prepMin);
    const pMax = num(prepMax);
    if (pMin !== null && pMax !== null && pMin > pMax) {
      return res
        .status(400)
        .json({ error: "Prep min cannot be greater than prep max" });
    }

    await accountModel.updateStall(acct.StallId, {
      stallName: String(stallName).trim(),
      cuisine: cuisine || "",
      desc: desc || "",
      unitNo: unit,
      phone: phone || null,
      prepMin: pMin,
      prepMax: pMax,
      imageUrl: imageUrl || null, // only overwritten if supplied
      supportsAddons: !!supportsAddons,
      supportsSizePricing: !!supportsSizePricing,
    });

    // Opening hours: validate then rewrite all 7 days
    if (Array.isArray(hours)) {
      for (const h of hours) {
        if (h.isClosed) continue;
        const bothOrNeither = !!h.openTime === !!h.closeTime;
        if (!bothOrNeither) {
          return res.status(400).json({
            error: "Each open day needs both an opening and closing time",
          });
        }
      }
      await accountModel.replaceStallHours(acct.StallId, hours);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("updateStall error:", err);
    res.status(500).json({ error: "Failed to update stall" });
  }
}

/* ===== PATCH /api/stall/account/stall-active ===== */

async function setStallActive(req, res) {
  try {
    const userId = getUserId(req, res);
    if (!userId) return;

    const acct = await accountModel.getAccount(userId);
    if (!acct?.StallId) {
      return res.status(404).json({ error: "No stall linked to this user" });
    }

    const { isActive } = req.body;

    // Going live requires a complete profile — same rules as the old canPublishStall()
    if (isActive) {
      const missing = [];
      if (!acct.StallName?.trim()) missing.push("stall name");
      if (!acct.Cuisine?.trim()) missing.push("cuisine");
      if (!acct.Desc?.trim()) missing.push("description");
      if (!acct.PrepMin || !acct.PrepMax) missing.push("prep time");
      if (!acct.ImageUrl?.trim()) missing.push("stall image");

      if (missing.length) {
        return res.status(400).json({
          error: `Cannot go live — missing: ${missing.join(", ")}`,
        });
      }
    }

    await accountModel.setStallActive(acct.StallId, !!isActive);
    res.json({ ok: true, isActive: !!isActive });
  } catch (err) {
    console.error("setStallActive error:", err);
    res.status(500).json({ error: "Failed to update stall status" });
  }
}

/* ===== PATCH /api/stall/account/password ===== */

async function changePassword(req, res) {
  try {
    const userId = getUserId(req, res);
    if (!userId) return;

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: "Current and new password are required" });
    }
    if (String(newPassword).length < 8) {
      return res
        .status(400)
        .json({ error: "New password must be at least 8 characters" });
    }

    const hash = await accountModel.getPasswordHash(userId);
    if (!hash) {
      return res
        .status(404)
        .json({ error: "No password set for this account" });
    }

    const ok = await bcrypt.compare(String(currentPassword), hash);
    if (!ok) {
      return res.status(403).json({ error: "Current password is incorrect" });
    }

    const newHash = await bcrypt.hash(String(newPassword), SALT_ROUNDS);
    const affected = await accountModel.setPasswordHash(userId, newHash);
    if (affected === 0) {
      return res.status(500).json({ error: "Failed to save new password" });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("changePassword error:", err);
    res.status(500).json({ error: "Failed to change password" });
  }
}

/* ===== POST /api/stall/account/deactivate ===== */

async function deactivateAccount(req, res) {
  try {
    const userId = getUserId(req, res);
    if (!userId) return;

    const { password } = req.body;
    if (!password) {
      return res
        .status(400)
        .json({ error: "Password is required to deactivate" });
    }

    const hash = await accountModel.getPasswordHash(userId);
    if (!hash) {
      return res
        .status(404)
        .json({ error: "No password set for this account" });
    }

    const ok = await bcrypt.compare(String(password), hash);
    if (!ok) {
      return res.status(403).json({ error: "Password is incorrect" });
    }

    const acct = await accountModel.getAccount(userId);
    await accountModel.deactivateAccount(userId, acct?.StallId || null);

    // Clear the auth cookie so they're logged out immediately
    res.clearCookie("accessToken");
    res.json({ ok: true });
  } catch (err) {
    console.error("deactivateAccount error:", err);
    res.status(500).json({ error: "Failed to deactivate account" });
  }
}

module.exports = {
  getAccount,
  updateProfile,
  updateNotifPrefs,
  updateStall,
  setStallActive,
  changePassword,
  deactivateAccount,
};
