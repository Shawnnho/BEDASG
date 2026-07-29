/*************************************************
 * account.js — Hawker Point (SQL version)
 * - Loads user profile from SQL via GET /api/cust/:id
 * - Auth via AuthClient (same pattern as menu.js / item.js) instead of
 *   Firebase Auth
 * - Edit Profile (name + phone + email)
 * - Saved item count via GET /api/favitems/get (built earlier)
 *
 * SCOPE NOTE: the old Firebase version also handled vouchers, order
 * history aggregation, avatar storage, password reset, and
 * deactivate-with-reauth - all via Firestore/Firebase Auth/Storage.
 * None of those have a confirmed SQL endpoint yet. Rather than guess
 * wrong and silently "work", every URL below that isn't the customer
 * profile endpoint you gave me is marked GUESS and wrapped so a missing
 * route degrades gracefully (shows "-" / a friendly message) instead of
 * breaking the page. Swap in real endpoints as you build them.
 *************************************************/

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

const redeemedVoucherCount = document.getElementById("redeemedVoucherCount");
const viewVouchersBtn = document.getElementById("viewVouchersBtn");

// optional badges
const notifCount = document.getElementById("notifCount");
const mNotifCount = document.getElementById("mNotifCount");

const voucherModal = document.getElementById("voucherModal");
const voucherModalList = document.getElementById("voucherModalList");
const voucherModalSub = document.getElementById("voucherModalSub");
const closeVoucherModal = document.getElementById("closeVoucherModal");

// Order History Summary DOM
const sumTotal = document.getElementById("sumTotal");
const sumLast = document.getElementById("sumLast");
const sumFav = document.getElementById("sumFav");
const viewOrdersBtn = document.getElementById("viewOrdersBtn");

// Favourites DOM
const savedStoresEl = document.getElementById("savedStores");
const savedItemsEl = document.getElementById("savedItems");

/* =========================
   API endpoints
========================= */
// CONFIRMED - matches the custController/custModel you gave me
const CUST_GET_URL = (uid) => `/api/cust/${encodeURIComponent(uid)}`;

// CONFIRMED - avatar is sent as a base64 data URL in the same JSON body as
// Name/Email/Phone (see CUST_UPDATE_URL below), matching the fileToBase64()
// pattern used on the complaints page - no multer/multipart involved.
const CUST_UPDATE_URL = (uid) => `/api/cust/${encodeURIComponent(uid)}`; // PUT (application/json)
const CUST_DEACTIVATE_URL = (uid) => `/api/cust/${encodeURIComponent(uid)}/deactivate`; // PATCH
const AUTH_FORGOT_PASSWORD_URL = "/api/auth/forgot-password"; // POST - GUESS, unused now that Change Password uses the modal below
// CONFIRMED - matches the custController/custModel/custRoutes changePassword you just built
const CUST_CHANGE_PASSWORD_URL = (uid) => `/api/cust/${encodeURIComponent(uid)}/password`; // PATCH
const ORDERS_SUMMARY_URL = (uid) => `/api/orders/summary/${encodeURIComponent(uid)}`; // GET
const VOUCHERS_LIST_URL = (uid) => `/api/vouchers/${encodeURIComponent(uid)}`; // GET

// CONFIRMED - built earlier in this project
const FAV_ITEMS_GET_URL = "/api/favitems/get";
// GUESS - follows the "/api/favstalls/{get,add,delete}" convention referenced
// in menu.js/home.js comments, but not confirmed to exist yet.
const FAV_STALLS_GET_URL = "/api/favstalls/get";

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

function setCheckedByValues(checkboxEls, values) {
  const arr = toArraySafe(values);
  const set = new Set(arr);
  checkboxEls.forEach((el) => (el.checked = set.has(el.value)));
}

function getCheckedValues(checkboxEls) {
  return checkboxEls.filter((el) => el.checked).map((el) => el.value);
}

function formatDateTime(ms) {
  if (!ms) return "—";
  try {
    const d = new Date(ms);
    return d.toLocaleString("en-SG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function applyBadge(count) {
  const n = Number(count || 0);
  if (notifCount) {
    notifCount.hidden = n <= 0;
    notifCount.textContent = n;
  }
  if (mNotifCount) {
    mNotifCount.hidden = n <= 0;
    mNotifCount.textContent = n;
  }
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
  btn.addEventListener("click", () => {
    const targetId = btn.dataset.target;
    const input = document.getElementById(targetId);
    if (!input) return;

    input.type = input.type === "password" ? "text" : "password";
    btn.setAttribute(
      "aria-label",
      input.type === "password" ? `Show ${targetId}` : `Hide ${targetId}`,
    );
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
        if (pwModalErr) pwModalErr.textContent = "Current password is incorrect.";
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
   Items endpoint is confirmed. Stalls endpoint is a GUESS - wrapped so a
   missing/404 route just shows "-" instead of breaking the page.
========================= */
async function loadFavouriteCounts(uid) {
  if (savedItemsEl) {
    try {
      const res = await AuthClient.apiFetch(
        `${FAV_ITEMS_GET_URL}?userId=${encodeURIComponent(uid)}`,
      );
      if (res.ok) {
        const rows = await res.json();
        savedItemsEl.textContent = String(Array.isArray(rows) ? rows.length : 0);
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
        savedStoresEl.textContent = String(Array.isArray(rows) ? rows.length : 0);
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
   GUESS endpoint - build /api/orders/summary/:uid returning
   { total, lastOrderAt, favouriteStall } and this will pick it up as-is.
========================= */
async function loadOrderHistorySummary(uid) {
  if (sumTotal) sumTotal.textContent = "0";
  if (sumLast) sumLast.textContent = "—";
  if (sumFav) sumFav.textContent = "—";

  try {
    const res = await AuthClient.apiFetch(ORDERS_SUMMARY_URL(uid));
    if (!res.ok) return; // endpoint not built yet - leave defaults

    const summary = await res.json();
    if (sumTotal) sumTotal.textContent = String(summary.total ?? 0);
    if (sumLast) {
      sumLast.textContent = summary.lastOrderAt
        ? formatDateTime(new Date(summary.lastOrderAt).getTime())
        : "—";
    }
    if (sumFav) sumFav.textContent = summary.favouriteStall || "—";
  } catch (err) {
    console.error("Failed to load order history summary:", err);
  }
}

/* =========================
   Vouchers
   GUESS endpoints - build a Vouchers table/API and this will pick it up.
   Left as a graceful "not available yet" state rather than fake data.
========================= */
async function updateRedeemedCount(uid) {
  if (!redeemedVoucherCount) return;

  try {
    const res = await AuthClient.apiFetch(VOUCHERS_LIST_URL(uid));
    if (!res.ok) {
      redeemedVoucherCount.textContent = "0";
      return;
    }
    const vouchers = await res.json();
    redeemedVoucherCount.textContent = String(
      vouchers.filter((v) => v.used).length,
    );
  } catch (err) {
    console.error("Failed to load redeemed voucher count:", err);
    redeemedVoucherCount.textContent = "0";
  }
}

function openVoucherModal() {
  if (!voucherModal) return;
  voucherModal.classList.add("isOpen");
  voucherModal.setAttribute("aria-hidden", "false");
}

function closeVoucherModalFn() {
  if (!voucherModal) return;
  voucherModal.classList.remove("isOpen");
  voucherModal.setAttribute("aria-hidden", "true");
}

function isExpiredVoucher(v) {
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

function renderVoucherModal(vouchers) {
  if (!voucherModalList) return;

  if (!vouchers.length) {
    voucherModalList.innerHTML = `
      <div class="emptyState">
        <h2 class="emptyTitle">No vouchers claimed</h2>
        <p style="margin:8px 0 0; font-weight:800; opacity:.75;">Go to Promotions to claim vouchers.</p>
      </div>
    `;
    return;
  }

  voucherModalList.innerHTML = vouchers
    .map((v) => {
      const disabled = v.used === true || isExpiredVoucher(v);
      const status =
        v.used === true
          ? "✅ Used"
          : isExpiredVoucher(v)
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
            data-apply-voucher="${v.id}"
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

async function markVoucherUsed(uid, voucherId) {
  // GUESS endpoint
  await AuthClient.apiFetch(
    `${VOUCHERS_LIST_URL(uid)}/${encodeURIComponent(voucherId)}/use`,
    { method: "POST" },
  );
}

/* =========================
   Auth gate + wiring
========================= */
(async () => {
  if (typeof AuthClient === "undefined") {
    setStatus(
      "❌ Auth script not loaded. Add <script src=\"js/auth-client.js\"></script> to account.html before account.js.",
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

    // Order history + favourites + vouchers
    await loadOrderHistorySummary(currentUid);
    await loadFavouriteCounts(currentUid);
    await updateRedeemedCount(currentUid);

    viewVouchersBtn?.addEventListener("click", async () => {
      openVoucherModal();
      if (voucherModalSub) voucherModalSub.textContent = "Loading…";
      if (voucherModalList) voucherModalList.innerHTML = "";

      try {
        const res = await AuthClient.apiFetch(VOUCHERS_LIST_URL(currentUid));
        if (!res.ok) throw new Error(`status ${res.status}`);
        const vouchers = await res.json();

        const active = vouchers.filter(
          (v) => !v.used && !isExpiredVoucher(v),
        ).length;
        const used = vouchers.filter((v) => v.used).length;

        if (voucherModalSub) {
          voucherModalSub.textContent = `Active: ${active} • Used: ${used} • Total: ${vouchers.length}`;
        }

        renderVoucherModal(vouchers);
      } catch (err) {
        console.error("Failed to load vouchers:", err);
        if (voucherModalSub) {
          voucherModalSub.textContent = "❌ Vouchers aren't available yet.";
        }
        if (voucherModalList) {
          voucherModalList.innerHTML = `
            <div class="emptyState">
              <h2 class="emptyTitle">Unable to load vouchers</h2>
              <p style="margin:8px 0 0; font-weight:800; opacity:.75;">This feature needs its backend endpoint built.</p>
            </div>
          `;
        }
      }
    });

    closeVoucherModal?.addEventListener("click", closeVoucherModalFn);
    voucherModal?.addEventListener("click", (e) => {
      if (e.target.matches("[data-close]")) {
        closeVoucherModalFn();
      }
    });

    voucherModalList?.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-apply-voucher]");
      if (!btn || btn.disabled) return;

      const voucherId = btn.dataset.applyVoucher;
      const code = btn.dataset.code;

      // Save for checkout
      localStorage.setItem("hawkerpoint_applied_promo", code);
      localStorage.setItem("hawkerpoint_applied_voucher_id", voucherId);

      await markVoucherUsed(currentUid, voucherId);
      window.location.href = "cart.html";
    });

    applyBadge(0);

    /* =========================
       LOAD PREFERENCES into checkboxes
       (from the profile response, if your /api/cust/:id ever includes them)
    ========================= */
    const prefs = data?.preferences || {};
    setCheckedByValues(prefCuisineEls, prefs.cuisines);
    setCheckedByValues(prefNotifEls, prefs.notifications);

    /* =========================
       SAVE PREFERENCES button
    ========================= */
    savePrefBtn?.addEventListener("click", async () => {
      try {
        const cuisines = getCheckedValues(prefCuisineEls);
        const notifications = getCheckedValues(prefNotifEls);

        const res = await AuthClient.apiFetch(CUST_PREFS_URL(currentUid), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cuisines, notifications }),
        });

        if (!res.ok) throw new Error(`status ${res.status}`);

        setStatus("✅ Preferences saved.");
      } catch (err) {
        console.error(err);
        setStatus(
          "❌ Failed to save preferences (backend endpoint may not exist yet).",
          false,
        );
      }
    });

    // Edit profile
    editProfileBtn?.addEventListener("click", () => {
      const currentName = (accName?.textContent || "").trim();
      const phoneText = (accPhone?.textContent || "").trim();
      const currentPhone =
        phoneText === "—" || phoneText === "-" ? "" : phoneText;
      const currentEmailText = (accEmail?.textContent || "").trim();
      const currentEmail =
        currentEmailText === "—" ? "" : currentEmailText;

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
          const avatarBase64 = avatarFile ? await fileToBase64(avatarFile) : null;

          let updatedCustomer = null;

          try {
            const res = await AuthClient.apiFetch(
              CUST_UPDATE_URL(currentUid),
              {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  Name: newName,
                  Email: newEmail,
                  Phone: newPhone,
                  AvatarUrl: avatarBase64,
                }),
              },
            );

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