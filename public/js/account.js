/*************************************************
 * account.js — Hawker Point (SQL version)
 * - Loads user profile from SQL via GET /api/cust/:id
 * - Auth via AuthClient (same pattern as menu.js / item.js) instead of
 *   Firebase Auth
 * - Edit Profile (name + phone + email)
 * - Saved item count via GET /api/favitems/get (built earlier)
 *
 * SCOPE NOTE: the old Firebase version also handled promotions, order
 * history aggregation, avatar storage, password reset, and
 * deactivate-with-reauth - all via Firestore/Firebase Auth/Storage.
 * None of those have a confirmed SQL endpoint yet. Rather than guess
 * wrong and silently "work", every URL below that isn't the customer
 * profile endpoint you gave me is marked GUESS and wrapped so a missing
 * route degrades gracefully (shows "-" / a friendly message) instead of
 * breaking the page. Swap in real endpoints as you build them.
 *************************************************/

/* =========================
   Guest guard — accounts are for registered users only. If not logged in,
   bounce to signup before any of the profile logic runs.
========================= */
(async () => {
  try {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (!res.ok) window.location.replace("signup.html");
  } catch {
    window.location.replace("signup.html");
  }
})();

/* =========================
   DOM
========================= */
const accAvatar = document.getElementById("accAvatar");
const accName = document.getElementById("accName");
const accRole = document.getElementById("accRole");
const accEmail = document.getElementById("accEmail");
const accPhone = document.getElementById("accPhone");

const editProfileBtn = document.getElementById("editProfileBtn");
const changePwBtn = document.getElementById("changePwBtn");
const logoutBtn = document.getElementById("logoutBtn");
const deactivateBtn = document.getElementById("deactivateBtn");
const accStatus = document.getElementById("accStatus");

// Change Password modal DOM
const pwModalOverlay = document.getElementById("pwModalOverlay");
const pwModalClose = document.getElementById("pwModalClose");
const pwChangeForm = document.getElementById("pwChangeForm");
const pwCurrent = document.getElementById("pwCurrent");
const pwNew = document.getElementById("pwNew");
const pwConfirm = document.getElementById("pwConfirm");
const pwNewHint = document.getElementById("pwNewHint");
const pwConfirmHint = document.getElementById("pwConfirmHint");
const pwModalErr = document.getElementById("pwModalErr");
const pwCancelBtn = document.getElementById("pwCancelBtn");
const pwSaveBtn = document.getElementById("pwSaveBtn");
const pwToggleBtns = Array.from(document.querySelectorAll(".pwToggleBtn"));

const redeemedPromoCount = document.getElementById("redeemedPromoCount");
const viewPromoBtn = document.getElementById("viewPromoBtn");

// optional badges
const notifCount = document.getElementById("notifCount");
const mNotifCount = document.getElementById("mNotifCount");

const promoModal = document.getElementById("promoModal");
const promoModalList = document.getElementById("promoModalList");
const promoModalSub = document.getElementById("promoModalSub");
const closePromoModal = document.getElementById("closePromoModal");

// Order History Summary DOM
const sumTotal = document.getElementById("sumTotal");
const sumLast = document.getElementById("sumLast");
const sumFav = document.getElementById("sumFav");
const viewOrdersBtn = document.getElementById("viewOrdersBtn");

// Favourites DOM
const savedStoresEl = document.getElementById("savedStores");
const savedItemsEl = document.getElementById("savedItems");

// Saved Cards DOM
const savedCardsContainer = document.getElementById("savedCardsContainer");

/* =========================
   API endpoints
========================= */
// CONFIRMED - matches the custController/custModel you gave me
const CUST_GET_URL = (uid) => `/api/cust/${encodeURIComponent(uid)}`;

// CONFIRMED - avatar is sent as a base64 data URL in the same JSON body as
// Name/Email/Phone (see CUST_UPDATE_URL below), matching the fileToBase64()
// pattern used on the complaints page - no multer/multipart involved.
const CUST_UPDATE_URL = (uid) => `/api/cust/${encodeURIComponent(uid)}`; // PUT (application/json)
const CUST_DEACTIVATE_URL = (uid) =>
  `/api/cust/${encodeURIComponent(uid)}/deactivate`; // PATCH
const AUTH_FORGOT_PASSWORD_URL = "/api/auth/forgot-password"; // POST - GUESS, unused now that Change Password uses the modal below
// CONFIRMED - matches the custController/custModel/custRoutes changePassword you just built
const CUST_CHANGE_PASSWORD_URL = (uid) =>
  `/api/cust/${encodeURIComponent(uid)}/password`; // PATCH
const ORDERS_URL = (uid) => `/api/orders/`; // GET
const PROMOS_LIST_URL = (uid) => `/api/promotions/${encodeURIComponent(uid)}`; // GET
const PROMOS_COUNT_URL = (uid) =>
  `/api/promotions/count/${encodeURIComponent(uid)}`; //GET

// CONFIRMED - built earlier in this project
const FAV_ITEMS_GET_URL = "/api/favitems/get";
// GUESS - follows the "/api/favstalls/{get,add,delete}" convention referenced
// in menu.js/home.js comments, but not confirmed to exist yet.
const FAV_STALLS_GET_URL = "/api/favstalls/get";

// NEW - Saved Cards Endpoints
const SAVED_CARDS_GET_URL = (uid) =>
  `/api/savedcards/${encodeURIComponent(uid)}`;
const SAVED_CARDS_ACTIVE_URL = (uid, cardId) =>
  `/api/savedcards/${encodeURIComponent(uid)}/${encodeURIComponent(cardId)}/active`;
const SAVED_CARDS_DELETE_URL = (uid, cardId) =>
  `/api/savedcards/${encodeURIComponent(uid)}/${encodeURIComponent(cardId)}`;

let currentUid = null;

/* =========================
   Helpers
========================= */
let statusTimer = null;

function setStatus(msg, ok = true, duration = 3500) {
  if (!accStatus) return;

  accStatus.textContent = msg;
  accStatus.classList.remove("error", "show");

  if (!ok) accStatus.classList.add("error");

  // force reflow so animation always plays
  void accStatus.offsetWidth;

  accStatus.classList.add("show");

  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    accStatus.classList.remove("show");
  }, duration);
}

function isPhone(v) {
  return /^[89]\d{7}$/.test(String(v || "").trim());
}

// Reads a File as a base64 data URL (e.g. "data:image/png;base64,...").
// Same helper used on the complaints page - replaces multer's multipart
// file upload with a plain JSON field.
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function roleLabel(r) {
  if (!r) return "Customer";
  if (r === "storeholder") return "Store Holder";
  if (r === "stall_owner") return "Store Holder";
  return r.charAt(0).toUpperCase() + r.slice(1);
}

/* =========================
   Change Password modal
========================= */
function openPwModal() {
  if (!pwModalOverlay) return;
  pwModalOverlay.hidden = false;
  pwModalOverlay.setAttribute("aria-hidden", "false");
  pwCurrent?.focus();
}

function closePwModal() {
  if (!pwModalOverlay) return;
  pwModalOverlay.hidden = true;
  pwModalOverlay.setAttribute("aria-hidden", "true");
  pwChangeForm?.reset();
  if (pwModalErr) pwModalErr.textContent = "";
  if (pwNewHint) {
    pwNewHint.textContent = "At least 8 characters.";
    pwNewHint.classList.remove("isBad", "isGood");
  }
  if (pwConfirmHint) {
    pwConfirmHint.textContent = "";
    pwConfirmHint.classList.remove("isBad", "isGood");
  }
  // Reset any show/hide toggles back to password type
  [pwCurrent, pwNew, pwConfirm].forEach((el) => {
    if (el) el.type = "password";
  });
}

/** Show/hide toggle buttons - swaps input type (icon swap is a nice-to-have,
 * left as a single icon for now since only one icon path was confirmed). */
pwToggleBtns.forEach((btn) => {
  const icon = btn.querySelector("img");

  btn.addEventListener("click", () => {
    const targetId = btn.dataset.target;
    const input = document.getElementById(targetId);
    if (!input) return;

    input.type = input.type === "password" ? "text" : "password";

    const isVisible = input.type === "text";
    icon.setAttribute("src", isVisible ? "images/hide.png" : "images/show.png");
    btn.setAttribute("aria-label", isVisible ? `Hide ${targetId}` : `Show ${targetId}`);
  });
});
/** Live hint: new password length */
pwNew?.addEventListener("input", () => {
  if (!pwNewHint) return;
  const val = pwNew.value;

  if (!val) {
    pwNewHint.textContent = "At least 8 characters.";
    pwNewHint.classList.remove("isBad", "isGood");
  } else if (val.length < 8) {
    pwNewHint.textContent = "Too short - needs at least 8 characters.";
    pwNewHint.classList.add("isBad");
    pwNewHint.classList.remove("isGood");
  } else {
    pwNewHint.textContent = "Looks good.";
    pwNewHint.classList.add("isGood");
    pwNewHint.classList.remove("isBad");
  }

  // Re-check confirm match whenever the new password changes
  if (pwConfirm?.value) pwConfirm.dispatchEvent(new Event("input"));
});

/** Live hint: confirm password match */
pwConfirm?.addEventListener("input", () => {
  if (!pwConfirmHint) return;
  const val = pwConfirm.value;

  if (!val) {
    pwConfirmHint.textContent = "";
    pwConfirmHint.classList.remove("isBad", "isGood");
  } else if (val !== pwNew?.value) {
    pwConfirmHint.textContent = "Passwords don't match.";
    pwConfirmHint.classList.add("isBad");
    pwConfirmHint.classList.remove("isGood");
  } else {
    pwConfirmHint.textContent = "Passwords match.";
    pwConfirmHint.classList.add("isGood");
    pwConfirmHint.classList.remove("isBad");
  }
});

pwModalClose?.addEventListener("click", closePwModal);
pwCancelBtn?.addEventListener("click", closePwModal);
pwModalOverlay?.addEventListener("click", (e) => {
  if (e.target === pwModalOverlay) closePwModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && pwModalOverlay && !pwModalOverlay.hidden) {
    closePwModal();
  }
});

pwChangeForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (pwModalErr) pwModalErr.textContent = "";

  const currentPassword = pwCurrent?.value || "";
  const newPassword = pwNew?.value || "";
  const confirmPassword = pwConfirm?.value || "";

  if (!currentPassword) {
    if (pwModalErr) pwModalErr.textContent = "Current password is required.";
    return;
  }
  if (newPassword.length < 8) {
    if (pwModalErr) {
      pwModalErr.textContent = "New password must be at least 8 characters.";
    }
    return;
  }
  if (newPassword !== confirmPassword) {
    if (pwModalErr) pwModalErr.textContent = "New passwords don't match.";
    return;
  }
  if (newPassword === currentPassword) {
    if (pwModalErr) {
      pwModalErr.textContent =
        "New password must be different from the current password.";
    }
    return;
  }

  pwSaveBtn?.classList.add("isLoading");
  if (pwSaveBtn) pwSaveBtn.disabled = true;

  try {
    const res = await AuthClient.apiFetch(
      CUST_CHANGE_PASSWORD_URL(currentUid),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      },
    );

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        if (pwModalErr)
          pwModalErr.textContent = "Current password is incorrect.";
        return;
      }
      throw new Error(`status ${res.status}`);
    }

    closePwModal();
    setStatus("✅ Password updated.");
  } catch (err) {
    console.error("Failed to change password:", err);
    if (pwModalErr) {
      pwModalErr.textContent =
        "Failed to update password (backend endpoint may not exist yet).";
    }
  } finally {
    pwSaveBtn?.classList.remove("isLoading");
    if (pwSaveBtn) pwSaveBtn.disabled = false;
  }
});

/* =========================
   Modal UI (unchanged - generic, not backend-specific)
========================= */
function openModal({ title, bodyHtml, primaryText = "Save", onPrimary }) {
  const overlay = document.createElement("div");
  overlay.className = "hpModalOverlay";
  overlay.innerHTML = `
    <div class="hpModal" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="hpModalHead">
        <div class="hpModalTitle">${title}</div>
        <button class="hpModalClose" type="button" aria-label="Close">✕</button>
      </div>

      <div class="hpModalBody">${bodyHtml}</div>

      <div class="hpModalFoot">
        <button class="hpModalBtn ghost" type="button" data-action="cancel">Cancel</button>
        <button class="hpModalBtn primary" type="button" data-action="primary">${primaryText}</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector(".hpModalClose").addEventListener("click", close);
  overlay
    .querySelector('[data-action="cancel"]')
    .addEventListener("click", close);

  overlay
    .querySelector('[data-action="primary"]')
    .addEventListener("click", async () => {
      try {
        await onPrimary({ overlay, close });
      } catch (err) {
        console.error(err);
        const errEl = overlay.querySelector(".hpModalErr");
        if (errEl) errEl.textContent = err?.message || "Something went wrong";
      }
    });

  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape") close();
    },
    { once: true },
  );

  return { overlay, close };
}

/* =========================
   Load profile (SQL)
========================= */
async function loadProfile(uid) {
  const res = await AuthClient.apiFetch(CUST_GET_URL(uid));

  if (!res.ok) {
    if (res.status === 404) throw new Error("Customer profile not found.");
    throw new Error(`Failed to load profile (status ${res.status})`);
  }

  return res.json();
}

/* =========================
   Favourites counts
========================= */
async function loadFavouriteCounts(uid) {
  if (savedItemsEl) {
    try {
      const res = await AuthClient.apiFetch(
        `${FAV_ITEMS_GET_URL}?userId=${encodeURIComponent(uid)}`,
      );
      if (res.ok) {
        const rows = await res.json();
        savedItemsEl.textContent = String(
          Array.isArray(rows) ? rows.length : 0,
        );
      } else {
        savedItemsEl.textContent = "—";
      }
    } catch (err) {
      console.error("Failed to load favourite item count:", err);
      savedItemsEl.textContent = "—";
    }
  }

  if (savedStoresEl) {
    try {
      const res = await AuthClient.apiFetch(
        `${FAV_STALLS_GET_URL}?userId=${encodeURIComponent(uid)}`,
      );
      if (res.ok) {
        const rows = await res.json();
        savedStoresEl.textContent = String(
          Array.isArray(rows) ? rows.length : 0,
        );
      } else {
        savedStoresEl.textContent = "—";
      }
    } catch (err) {
      console.error("Failed to load favourite stall count:", err);
      savedStoresEl.textContent = "—";
    }
  }
}

/* =========================
   Order history summary
========================= */
async function loadOrderHistorySummary(uid) {
  if (sumTotal) sumTotal.textContent = "0";
  if (sumLast) sumLast.textContent = "—";
  if (sumFav) sumFav.textContent = "—";

  try {
    const res = await AuthClient.apiFetch(ORDERS_URL(uid));
    if (!res.ok) return; // endpoint not built yet - leave defaults

    const orders = await res.json();
    console.log(new Date(orders.orders[0].createdAt));
    if (sumTotal) sumTotal.textContent = String(orders.orders.length ?? 0);
    if (sumLast) {
      sumLast.textContent = orders.orders[0].createdAt
        ? formatDateTime(new Date(orders.orders[0].createdAt))
        : "—";
    }
    if (sumFav) sumFav.textContent = getMostOrderedStall(orders.orders) || "—";
  } catch (err) {
    console.error("Failed to load order history summary:", err);
  }
}

function formatDateTime(date) {
  const formatted = date.toLocaleString("en-SG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return formatted;
}

function getMostOrderedStall(orders) {
  const counts = {};

  for (const order of orders) {
    const stall = order.stallName;
    counts[stall] = (counts[stall] || 0) + 1;
  }
  let mostOrderedStall = null;
  let maxCount = 0;
  for (const stall in counts) {
    if (counts[stall] > maxCount) {
      maxCount = counts[stall];
      mostOrderedStall = stall;
    }
  }
  return mostOrderedStall;
}

/* =========================
   Promotions
========================= */
async function updateRedeemedCount(uid) {
  if (!redeemedPromoCount) return;

  try {
    const res = await AuthClient.apiFetch(PROMOS_COUNT_URL(uid));
    if (!res.ok) {
      redeemedPromoCount.textContent = "0";
      return;
    }
    const promosCount = await res.json();
    redeemedPromoCount.textContent = promosCount.count;
  } catch (err) {
    console.error("Failed to load redeemed promo count:", err);
    redeemedPromoCount.textContent = "0";
  }
}

function openPromoModal() {
  if (!promoModal) return;
  promoModal.classList.add("isOpen");
  promoModal.setAttribute("aria-hidden", "false");
}

function closePromoModalFn() {
  if (!promoModal) return;
  promoModal.classList.remove("isOpen");
  promoModal.setAttribute("aria-hidden", "true");
}

function isExpiredPromo(v) {
  if (!v.expiresAt) return false;
  return Date.now() > new Date(v.expiresAt).getTime();
}

function expiryText(v) {
  if (!v.expiresAt) return "No expiry";
  const days = Math.ceil(
    (new Date(v.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
  );
  if (days <= 0) return "Expired";
  if (days === 1) return "Expires in 1 day";
  return `Expires in ${days} days`;
}

function renderPromoModal(promos) {
  if (!promoModalList) return;

  if (!promos.length) {
    promoModalList.innerHTML = `
      <div class="emptyState">
        <h2 class="emptyTitle">No promotions claimed</h2>
        <p style="margin:8px 0 0; font-weight:800; opacity:.75;">Check the Promotions page to claim more.</p>
      </div>
    `;
    return;
  }

  promoModalList.innerHTML = promos
    .map((v) => {
      const disabled = v.used === true || isExpiredPromo(v);
      const status =
        v.used === true
          ? "✅ Used"
          : isExpiredPromo(v)
            ? "❌ Expired"
            : "✅ Active";

      return `
      <div class="hpVoucherRow">
        <div class="hpVoucherLeft">
          <div class="code">${v.code}</div>
          <div class="meta">${status} • ${expiryText(v)}</div>
        </div>

        <div class="hpVoucherRight">
          <button
            class="btn small primary"
            data-apply-promo="${v.id}"
            data-code="${v.code}"
            ${disabled ? "disabled" : ""}>
            ${disabled ? (v.used ? "Used" : "Expired") : "Apply"}
          </button>
        </div>
      </div>
    `;
    })
    .join("");
}

async function markPromoUsed(uid, promoId) {
  await AuthClient.apiFetch(
    `${PROMOS_LIST_URL(uid)}/${encodeURIComponent(promoId)}/use`,
    { method: "POST" },
  );
}

/* =========================
   Saved Payment Methods
========================= */
async function fetchAndRenderSavedCards(uid) {
  if (!savedCardsContainer) return;
  savedCardsContainer.innerHTML =
    '<p style="margin:0; font-size:14px; color:#666;">Loading payment methods...</p>';

  try {
    const res = await AuthClient.apiFetch(SAVED_CARDS_GET_URL(uid));
    if (!res.ok) throw new Error("Failed to load cards");
    const cards = await res.json();

    if (!cards || cards.length === 0) {
      savedCardsContainer.innerHTML =
        '<p style="margin:0; font-size:14px; color:#666;">No saved payment methods.</p>';
      return;
    }

    savedCardsContainer.innerHTML = cards
      .map((card) => {
        const inUse = card.InUse === 1 || card.InUse === true;
        return `
         <div class="savedCardRow ${inUse ? "activeCard" : ""}">
            <div class="savedCardInfo">
                <span class="savedCardBrand">${card.CardBrand}</span>
                <span class="cardNum">•••• ${card.Last4}</span>
                <span class="cardExp">Exp: ${String(card.ExpMonth).padStart(2, "0")}/${String(card.ExpYear).slice(-2)}</span>
                ${inUse ? '<span class="inUseBadge">In Use</span>' : ""}
            </div>
            <div class="savedCardActions">
                ${!inUse ? `<button class="btn small primary useCardBtn" data-id="${card.SavedCardId}">Use</button>` : ""}
                <button class="btn small dangerBtn deleteCardBtn" data-id="${card.SavedCardId}">Delete</button>
            </div>
         </div>
       `;
      })
      .join("");
  } catch (err) {
    console.error("Error loading saved cards:", err);
    savedCardsContainer.innerHTML =
      '<p style="margin:0; font-size:14px; color:#b00020;">Failed to load cards.</p>';
  }
}

// Event listener for the dynamically created Use and Delete buttons
savedCardsContainer?.addEventListener("click", async (e) => {
  const useBtn = e.target.closest(".useCardBtn");
  const delBtn = e.target.closest(".deleteCardBtn");

  if (useBtn) {
    const cardId = useBtn.dataset.id;
    useBtn.disabled = true;
    try {
      const res = await AuthClient.apiFetch(
        SAVED_CARDS_ACTIVE_URL(currentUid, cardId),
        { method: "PATCH" },
      );
      if (!res.ok) throw new Error("Failed to set active card");
      await fetchAndRenderSavedCards(currentUid); // Refresh the list
      setStatus("✅ Card set as active payment method.");
    } catch (err) {
      setStatus("❌ Failed to update card.", false);
      useBtn.disabled = false;
    }
  }

  if (delBtn) {
    if (!confirm("Are you sure you want to delete this card?")) return;
    const cardId = delBtn.dataset.id;
    delBtn.disabled = true;
    try {
      const res = await AuthClient.apiFetch(
        SAVED_CARDS_DELETE_URL(currentUid, cardId),
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Failed to delete card");
      await fetchAndRenderSavedCards(currentUid); // Refresh the list
      setStatus("✅ Card deleted.");
    } catch (err) {
      setStatus("❌ Failed to delete card.", false);
      delBtn.disabled = false;
    }
  }
});

/* =========================
   Auth gate + wiring
========================= */
(async () => {
  if (typeof AuthClient === "undefined") {
    setStatus(
      '❌ Auth script not loaded. Add <script src="js/auth-client.js"></script> to account.html before account.js.',
      false,
      8000,
    );
    console.error(
      "AuthClient is undefined - account.html is missing the <script> tag that defines window.AuthClient.",
    );
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const isGuest = params.get("mode") === "guest";

  try {
    const user = await AuthClient.getCurrentUser();

    if (!user) {
      window.location.href = isGuest ? "signin.html?from=guest" : "signin.html";
      return;
    }

    currentUid = user.id;

    const data = await loadProfile(currentUid);

    if (data?.deactivated) {
      setStatus("❌ This account has been deactivated.", false);
      setTimeout(async () => {
        await AuthClient.logout?.(); // GUESS: adjust to your actual AuthClient API if named differently
        window.location.href = "index.html";
      }, 2000);
      return;
    }

    // Populate profile UI
    accName.textContent = data?.name || "—";
    accRole.textContent = roleLabel(data?.role);
    accEmail.textContent = data?.email || "—";
    accPhone.textContent = data?.phone ? String(data.phone).trim() : "—";
    if (accAvatar) accAvatar.src = data?.pfp || "images/defaultprofile.png";

    viewOrdersBtn?.addEventListener("click", () => {
      window.location.href = "orders.html";
    });

    // Order history + favourites + promotions
    await loadOrderHistorySummary(currentUid);
    await loadFavouriteCounts(currentUid);
    await updateRedeemedCount(currentUid);
    await fetchAndRenderSavedCards(currentUid);

    viewPromoBtn?.addEventListener("click", async () => {
      openPromoModal();
      if (promoModalSub) promoModalSub.textContent = "Loading…";
      if (promoModalList) promoModalList.innerHTML = "";

      try {
        const res = await AuthClient.apiFetch(PROMOS_LIST_URL(currentUid));
        if (!res.ok) throw new Error(`status ${res.status}`);
        const promos = await res.json();

        const active = promos.filter(
          (v) => !v.used && !isExpiredPromo(v),
        ).length;
        const used = promos.filter((v) => v.used).length;

        if (promoModalSub) {
          promoModalSub.textContent = `Active: ${active} • Used: ${used} • Total: ${promos.length}`;
        }

        renderPromoModal(promos);
      } catch (err) {
        console.error("Failed to load promotions:", err);
        if (promoModalSub) {
          promoModalSub.textContent = "❌ Promotions aren't available yet.";
        }
        if (promoModalList) {
          promoModalList.innerHTML = `
            <div class="emptyState">
              <h2 class="emptyTitle">Unable to load promotions</h2>
              <p style="margin:8px 0 0; font-weight:800; opacity:.75;">This feature needs its backend endpoint built.</p>
            </div>
          `;
        }
      }
    });

    closePromoModal?.addEventListener("click", closePromoModalFn);
    promoModal?.addEventListener("click", (e) => {
      if (e.target.matches("[data-close]")) {
        closePromoModalFn();
      }
    });

    promoModalList?.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-apply-promo]");
      if (!btn || btn.disabled) return;

      const promoId = btn.dataset.applyPromo;
      const code = btn.dataset.code;

      // Save for checkout
      localStorage.setItem("hawkerpoint_applied_promo", code);
      localStorage.setItem("hawkerpoint_applied_promo_id", promoId);

      await markPromoUsed(currentUid, promoId);
      window.location.href = "cart.html";
    });

    // Edit profile
    editProfileBtn?.addEventListener("click", () => {
      const currentName = (accName?.textContent || "").trim();
      const phoneText = (accPhone?.textContent || "").trim();
      const currentPhone =
        phoneText === "—" || phoneText === "-" ? "" : phoneText;
      const currentEmailText = (accEmail?.textContent || "").trim();
      const currentEmail = currentEmailText === "—" ? "" : currentEmailText;

      const { overlay } = openModal({
        title: "Edit Profile",
        primaryText: "Save",
        bodyHtml: `
      <div class="hpModalRow">
  <div class="hpModalLabel">Profile Picture</div>

  <div class="hpAvatarStack">
    <img
      id="mAvatarPreview"
      class="hpAvatarPreview"
      src="${accAvatar?.src || "images/defaultprofile.png"}"
      alt="Profile picture preview"
    />

    <div class="hpAvatarControls">
      <input id="mAvatar" type="file" accept="image/*" />
      <div class="hpModalHint">Saved to your account.</div>
    </div>
  </div>
</div>


      <div class="hpModalRow">
        <label class="hpModalLabel">Name</label>
        <input id="mName" class="hpModalInput" type="text"
          value="${currentName.replace(/"/g, "&quot;")}" />
      </div>

      <div class="hpModalRow">
        <label class="hpModalLabel">Email</label>
        <input id="mEmail" class="hpModalInput" type="email"
        value="${currentEmail.replace(/"/g, "&quot;")}"/>
      </div>

      <div class="hpModalRow">
        <label class="hpModalLabel">Phone (SG)</label>
        <input id="mPhone" class="hpModalInput" type="text"
          value="${currentPhone.replace(/"/g, "&quot;")}" />
      </div>

      <div class="hpModalErr" style="color:#b00020;font-weight:700;"></div>
    `,

        onPrimary: async ({ overlay, close }) => {
          const nameEl = overlay.querySelector("#mName");
          const emailEl = overlay.querySelector("#mEmail");
          const phoneEl = overlay.querySelector("#mPhone");
          const err = overlay.querySelector(".hpModalErr");

          if (!nameEl || !emailEl || !phoneEl) {
            if (err) {
              err.textContent =
                "Modal inputs missing (check IDs in modal HTML).";
            }
            return;
          }

          const newName = nameEl.value.trim();
          const newEmail = emailEl.value.trim();
          const newPhone = phoneEl.value.trim();
          const avatarFile = overlay.querySelector("#mAvatar")?.files?.[0];

          if (!newName) {
            err.textContent = "Name cannot be empty.";
            return;
          }
          if (!newEmail) {
            err.textContent = "Email cannot be empty.";
            return;
          }
          if (!newPhone) {
            err.textContent = "Phone cannot be empty.";
            return;
          }
          if (!isPhone(newPhone)) {
            err.textContent = "Invalid SG phone number.";
            return;
          }
          if (avatarFile && avatarFile.size > 5 * 1024 * 1024) {
            err.textContent = "Image too large (max 5MB).";
            return;
          }

          // Single JSON request: Name/Email/Phone as plain fields, plus
          // AvatarUrl as a base64 data URL if a new photo was chosen. If no
          // new photo is selected, AvatarUrl is omitted (null) and the
          // backend leaves the existing avatar untouched.
          const avatarBase64 = avatarFile
            ? await fileToBase64(avatarFile)
            : null;

          let updatedCustomer = null;

          try {
            const res = await AuthClient.apiFetch(CUST_UPDATE_URL(currentUid), {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                Name: newName,
                Email: newEmail,
                Phone: newPhone,
                AvatarUrl: avatarBase64,
              }),
            });

            if (!res.ok) throw new Error(`status ${res.status}`);
            updatedCustomer = await res.json();
          } catch (saveErr) {
            console.error(saveErr);
            err.textContent = "Failed to save profile. Please try again.";
            return;
          }

          accName.textContent = newName;
          accPhone.textContent = newPhone || "—";
          accEmail.textContent = newEmail || "—";
          if (accAvatar && updatedCustomer?.pfp) {
            accAvatar.src = updatedCustomer.pfp;
          }

          setStatus("✅ Profile updated.");
          close();
        },
      });

      const fileInput = overlay.querySelector("#mAvatar");
      const previewImg = overlay.querySelector("#mAvatarPreview");

      if (fileInput && previewImg) {
        fileInput.addEventListener("change", () => {
          const file = fileInput.files?.[0];
          if (!file) return;

          const url = URL.createObjectURL(file);
          previewImg.src = url;
          previewImg.onload = () => URL.revokeObjectURL(url);
        });
      }
    });

    // Change password - opens the modal (current/new/confirm)
    changePwBtn?.addEventListener("click", () => {
      openPwModal();
    });

    // Logout
    logoutBtn?.addEventListener("click", async () => {
      await AuthClient.logout?.(); // GUESS: adjust to your actual AuthClient API if named differently
      window.location.href = "index.html";
    });

    // Deactivate
    // GUESS endpoint - backend should verify the password server-side before deactivating
    deactivateBtn?.addEventListener("click", () => {
      const { overlay, close } = openModal({
        title: "Deactivate Account",
        primaryText: "Deactivate",
        bodyHtml: `
      <p style="margin:0 0 10px; font-weight:800;">
        This will disable your account and log you out.
      </p>
      <p style="margin:0 0 14px; opacity:.85;">
        For security, please enter your password to confirm.
      </p>

      <div class="hpModalRow">
        <label class="hpModalLabel">Password</label>
        <input id="mDeactPw" class="hpModalInput" type="password" placeholder="Enter password" />
      </div>

      <div class="hpModalErr" style="color:#b00020;font-weight:700;"></div>
    `,
        onPrimary: async ({ close }) => {
          const pwEl = overlay.querySelector("#mDeactPw");
          const errEl = overlay.querySelector(".hpModalErr");

          const password = (pwEl?.value || "").trim();
          if (!password) {
            errEl.textContent = "Password is required.";
            return;
          }

          try {
            const res = await AuthClient.apiFetch(
              CUST_DEACTIVATE_URL(currentUid),
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
              },
            );

            if (!res.ok) {
              if (res.status === 401) {
                errEl.textContent = "Incorrect password.";
                return;
              }
              throw new Error(`status ${res.status}`);
            }

            setStatus("✅ Account deactivated. Logging you out…");

            setTimeout(async () => {
              await AuthClient.logout?.();
              window.location.href = "index.html";
            }, 900);

            close();
          } catch (e) {
            console.error(e);
            errEl.textContent =
              "Failed to deactivate (backend endpoint may not exist yet).";
          }
        },
      });

      // Enter key submits
      overlay.querySelector("#mDeactPw")?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          overlay.querySelector('[data-action="primary"]')?.click();
        }
      });
    });
  } catch (err) {
    console.error(err);
    setStatus(`❌ Failed to load account: ${err.message}`, false);
  }
})();
