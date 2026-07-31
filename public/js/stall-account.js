// stall-account.js — MSSQL/Express (no Firebase), cookie auth
// Profile, stall details, opening hours, notification prefs, password, deactivate.

const API_BASE = "";
const $ = (id) => document.getElementById(id);

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

let acct = null; // last loaded payload

/* ===== helpers ===== */
function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setText(id, v) {
  const el = $(id);
  if (el) el.textContent = v ?? "—";
}

function showToast(msg) {
  const t = $("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}

// "17:30" -> "5:30 PM"
function to12h(hhmm) {
  if (!hhmm || !hhmm.includes(":")) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const isPM = h >= 12;
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:${String(m).padStart(2, "0")} ${isPM ? "PM" : "AM"}`;
}

function fileToBase64(fileInput, maxMb = 1.5) {
  const file = fileInput?.files?.[0];
  if (!file) return Promise.resolve(null);
  if (file.size > maxMb * 1024 * 1024) {
    return Promise.reject(new Error(`Image too large (max ~${maxMb}MB)`));
  }
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("Failed to read image"));
    r.readAsDataURL(file);
  });
}

async function api(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (res.status === 401 || res.status === 403) {
    location.href = "signin.html";
    throw new Error("unauth");
  }
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

/* ===== modal ===== */
function openModal({ title, bodyHtml, primaryText = "Save", onPrimary }) {
  const overlay = document.createElement("div");
  overlay.className = "hpModalOverlay";
  overlay.innerHTML = `
    <div class="hpModal" role="dialog" aria-modal="true">
      <div class="hpModalHead">
        <div class="hpModalTitle">${esc(title)}</div>
        <button class="hpModalClose" type="button">✕</button>
      </div>
      <div class="hpModalBody">${bodyHtml}</div>
      <div class="hpModalFoot">
        <button class="hpModalBtn ghost" type="button" data-cancel>Cancel</button>
        <button class="hpModalBtn primary" type="button" data-primary>${esc(primaryText)}</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";

  const close = () => {
    overlay.remove();
    document.body.style.overflow = "";
  };

  overlay.querySelector(".hpModalClose").onclick = close;
  overlay.querySelector("[data-cancel]").onclick = close;
  overlay.onclick = (e) => {
    if (e.target === overlay) close();
  };

  const primaryBtn = overlay.querySelector("[data-primary]");
  primaryBtn.onclick = async () => {
    primaryBtn.disabled = true;
    try {
      await onPrimary({ overlay, close });
    } finally {
      primaryBtn.disabled = false;
    }
  };

  return { overlay, close };
}

function setErr(overlay, msg, ok = false) {
  const el = overlay.querySelector(".hpModalErr");
  if (!el) return;
  el.textContent = msg;
  el.style.color = ok ? "#166534" : "#b00020";
}

/* ===== render ===== */
function render(data) {
  acct = data;
  const p = data.profile;
  const s = data.stall;

  // header
  setText("ownerName", p.name || "Owner");
  setText("stallName", s?.stallName || "—");

  // profile card
  setText("profileName", p.name);
  setText("email", p.email);
  setText("phone", p.phone || "—");
  const av = $("avatar");
  if (av) av.src = p.avatarUrl || "images/defaultprofile.png";

  // notif prefs
  $("prefNewOrders").checked = !!data.notifPrefs.newOrders;
  $("prefOrderUpdates").checked = !!data.notifPrefs.orderUpdates;
  $("prefNewReview").checked = !!data.notifPrefs.newReview;
  $("prefHygiene").checked = !!data.notifPrefs.hygiene;

  if (!s) return;

  // stall status
  const live = !!s.isActive;
  $("stallActiveToggle").checked = live;
  setText("stallActiveText", live ? "Live" : "Offline");
  syncLiveBand(live); // update the availability band visuals

  const pill = $("stallStatusPill");
  if (pill) {
    pill.textContent = live ? "Live" : "Offline";
    pill.classList.toggle("isLive", live);
    pill.classList.toggle("isOffline", !live);
  }

  setText("hygieneGrade", s.hygieneGrade || "—");
  setText(
    "stallRating",
    s.rating != null ? `${s.rating} (${s.ratingCount})` : "—",
  );

  // stall details
  setText("stallName2", s.stallName);
  setText("cuisine", s.cuisine || "—");
  setText("unitNo", s.unitNo || "—");
  setText(
    "prepTime",
    s.prepMin && s.prepMax ? `${s.prepMin}–${s.prepMax} min` : "—",
  );
  // mirror prep time into the stat strip card
  setText(
    "prepTimeStat",
    s.prepMin && s.prepMax ? `${s.prepMin}–${s.prepMax} min` : "—",
  );
  setText("stallDesc", s.desc || "—");

  // hours
  const hoursEl = $("hoursList");
  if (hoursEl) {
    const byDay = new Map(data.hours.map((h) => [h.dayOfWeek, h]));
    hoursEl.innerHTML = DAYS.map((label, i) => {
      const h = byDay.get(i);
      const closed = !h || h.isClosed || !h.openTime;
      const txt = closed
        ? `<span class="acctHourTime closed">Closed</span>`
        : `<span class="acctHourTime">${to12h(h.openTime)} – ${to12h(h.closeTime)}</span>`;
      return `<div class="acctHourRow">
                <span class="acctHourDay">${label}</span>${txt}
              </div>`;
    }).join("");
  }

  // feature pills
  setFeature("featSizes", !!s.supportsSizePricing);
  setFeature("featAddons", !!s.supportsAddons);
}

/* Toggle a feature pill's on/off state and swap its leading icon.
   Keeps any <i class="ti ..."> child intact instead of wiping it. */
function setFeature(id, on) {
  const el = $(id);
  if (!el) return;
  el.classList.toggle("isOn", on);
  const icon = el.querySelector("i");
  if (icon) icon.className = "ti " + (on ? "ti-check" : "ti-plus");
}

async function load() {
  try {
    const data = await api("/api/stall/account");
    render(data);
  } catch (err) {
    if (err.message !== "unauth") {
      console.error(err);
      showToast("Failed to load account.");
    }
  }
}

/* ===== edit profile ===== */
$("editProfileBtn")?.addEventListener("click", () => {
  if (!acct) return showToast("Account still loading — try again in a moment.");
  const p = acct.profile;

  const { overlay } = openModal({
    title: "Edit Profile",
    bodyHtml: `
      <div class="hpModalRow">
        <label class="hpModalLabel">Profile Picture</label>
        <input id="mAvatar" type="file" accept="image/*" class="hpModalFile" />
        <img id="mAvatarPreview" class="hpStallImagePreview"
             src="${esc(p.avatarUrl || "images/defaultprofile.png")}"
             style="margin-top:10px; max-height:120px;" />
      </div>

      <div class="hpModalRow">
        <label class="hpModalLabel">Name</label>
        <input id="mName" class="hpModalInput" value="${esc(p.name)}" />
      </div>

      <div class="hpModalRow">
        <label class="hpModalLabel">Email</label>
        <input class="hpModalInput" value="${esc(p.email)}" disabled />
        <div class="acctHint">Email cannot be changed here.</div>
      </div>

      <div class="hpModalRow">
        <label class="hpModalLabel">Phone (SG)</label>
        <input id="mPhone" class="hpModalInput" value="${esc(p.phone)}" placeholder="91234567" />
      </div>

      <div class="hpModalErr" style="font-weight:800;"></div>`,
    onPrimary: async ({ overlay, close }) => {
      const name = overlay.querySelector("#mName").value.trim();
      const phone = overlay.querySelector("#mPhone").value.trim();

      if (!name) return setErr(overlay, "Name cannot be empty.");

      try {
        const avatarUrl = await fileToBase64(overlay.querySelector("#mAvatar"));
        await api("/api/stall/account/profile", {
          method: "PATCH",
          body: JSON.stringify({ name, phone, avatarUrl }),
        });
        close();
        showToast("Profile updated");
        await load();
      } catch (err) {
        if (err.message !== "unauth") setErr(overlay, err.message);
      }
    },
  });

  // live avatar preview
  const fileEl = overlay.querySelector("#mAvatar");
  const prevEl = overlay.querySelector("#mAvatarPreview");
  fileEl?.addEventListener("change", () => {
    const f = fileEl.files?.[0];
    if (f && prevEl) prevEl.src = URL.createObjectURL(f);
  });
});

/* ===== edit stall details ===== */
$("editStallBtn")?.addEventListener("click", () => {
  if (!acct) return showToast("Account still loading — try again in a moment.");
  const s = acct.stall;
  if (!s) return;

  const byDay = new Map(acct.hours.map((h) => [h.dayOfWeek, h]));

  const hourRows = DAYS.map((label, i) => {
    const h = byDay.get(i) || {};
    const closed = h.isClosed || !h.openTime;
    return `
      <div class="hourEditRow" data-day="${i}">
        <span class="hourDayLabel">${label}</span>
        <input type="time" data-open  value="${esc(h.openTime || "")}"  ${closed ? "disabled" : ""} />
        <input type="time" data-close value="${esc(h.closeTime || "")}" ${closed ? "disabled" : ""} />
        <label class="hourClosedLabel">
          <input type="checkbox" data-closed ${closed ? "checked" : ""} /> Closed
        </label>
      </div>`;
  }).join("");

  const { overlay } = openModal({
    title: "Edit Stall Details",
    bodyHtml: `
      <div class="hpModalRow">
        <label class="hpModalLabel">Stall Name</label>
        <input id="mStallName" class="hpModalInput" value="${esc(s.stallName)}" />
      </div>


      <div class="hpModalRow">
        <label class="hpModalLabel">Cuisine</label>
        <input id="mCuisine" class="hpModalInput" value="${esc(s.cuisine)}" placeholder="Beverages / Western / Chinese" />
      </div>

      <div class="hpModalRow">
        <label class="hpModalLabel">Description</label>
        <textarea id="mDesc" class="hpModalInput" rows="3">${esc(s.desc)}</textarea>
      </div>

      <div class="hpModalRow">
        <label class="hpModalLabel">Unit No</label>
        <input id="mUnit" class="hpModalInput" value="${esc(s.unitNo)}" placeholder="01-04" />
      </div>

      <div class="hpModalRow">
        <label class="hpModalLabel">Stall Contact Number</label>
        <input id="mStallPhone" class="hpModalInput" value="${esc(s.phone)}" placeholder="91234567" />
      </div>

      <div class="hpModalRow">
        <label class="hpModalLabel">Prep Time (minutes)</label>
        <div style="display:flex; gap:8px;">
          <input id="mPrepMin" class="hpModalInput" type="number" min="0" placeholder="Min" value="${s.prepMin ?? ""}" />
          <input id="mPrepMax" class="hpModalInput" type="number" min="0" placeholder="Max" value="${s.prepMax ?? ""}" />
        </div>
      </div>

      <div class="hpModalRow">
        <label class="hpModalLabel">Stall Image</label>
        <input id="mStallImg" type="file" accept="image/*" class="hpModalFile" />
        <img id="mStallImgPreview" class="hpStallImagePreview"
             src="${esc(s.imageUrl || "images/defaultfood.png")}" style="margin-top:10px;" />
      </div>

      <div class="hpModalRow">
        <label class="hpModalLabel">Opening Hours</label>
        <div class="hoursEditor">${hourRows}</div>
      </div>

      <div class="hpModalRow">
        <label class="hpModalLabel">Menu Features</label>
        <label class="acctCheckRow">
          <input type="checkbox" id="mSizes" ${s.supportsSizePricing ? "checked" : ""} />
          <span>My items come in multiple sizes
            <span class="acctHint">Enables size pricing on the menu page.</span>
          </span>
        </label>
        <label class="acctCheckRow">
          <input type="checkbox" id="mAddons" ${s.supportsAddons ? "checked" : ""} />
          <span>My items support add-ons
            <span class="acctHint">Enables the add-ons manager.</span>
          </span>
        </label>
      </div>

      <div class="hpModalErr" style="font-weight:800;"></div>`,
    onPrimary: async ({ overlay, close }) => {
      const stallName = overlay.querySelector("#mStallName").value.trim();
      if (!stallName) return setErr(overlay, "Stall name is required.");

      // collect the 7 day rows
      const hours = Array.from(overlay.querySelectorAll(".hourEditRow")).map(
        (row) => ({
          dayOfWeek: Number(row.dataset.day),
          isClosed: row.querySelector("[data-closed]").checked,
          openTime: row.querySelector("[data-open]").value || "",
          closeTime: row.querySelector("[data-close]").value || "",
        }),
      );

      for (const h of hours) {
        if (h.isClosed) continue;
        if (!!h.openTime !== !!h.closeTime) {
          return setErr(
            overlay,
            `${DAYS[h.dayOfWeek]}: needs both open and close time.`,
          );
        }
      }

      try {
        const imageUrl = await fileToBase64(
          overlay.querySelector("#mStallImg"),
        );

        await api("/api/stall/account/stall", {
          method: "PATCH",
          body: JSON.stringify({
            stallName,
            cuisine: overlay.querySelector("#mCuisine").value.trim(),
            desc: overlay.querySelector("#mDesc").value.trim(),
            unitNo: overlay.querySelector("#mUnit").value.trim(),
            phone: overlay.querySelector("#mStallPhone").value.trim(),
            prepMin: overlay.querySelector("#mPrepMin").value || null,
            prepMax: overlay.querySelector("#mPrepMax").value || null,
            imageUrl,
            supportsSizePricing: overlay.querySelector("#mSizes").checked,
            supportsAddons: overlay.querySelector("#mAddons").checked,
            hours,
          }),
        });

        close();
        showToast("Stall updated");
        await load();
      } catch (err) {
        if (err.message !== "unauth") setErr(overlay, err.message);
      }
    },
  });

  // disable time inputs when "Closed" is ticked
  overlay.querySelectorAll(".hourEditRow").forEach((row) => {
    const closedEl = row.querySelector("[data-closed]");
    const openEl = row.querySelector("[data-open]");
    const closeEl = row.querySelector("[data-close]");
    closedEl.addEventListener("change", () => {
      const off = closedEl.checked;
      openEl.disabled = off;
      closeEl.disabled = off;
      if (off) {
        openEl.value = "";
        closeEl.value = "";
      }
    });
  });

  // live image preview
  const imgEl = overlay.querySelector("#mStallImg");
  const imgPrev = overlay.querySelector("#mStallImgPreview");
  imgEl?.addEventListener("change", () => {
    const f = imgEl.files?.[0];
    if (f && imgPrev) imgPrev.src = URL.createObjectURL(f);
  });
});

/* ===== stall live toggle ===== */
$("stallActiveToggle")?.addEventListener("change", async (e) => {
  const want = e.target.checked;
  try {
    await api("/api/stall/account/stall-active", {
      method: "PATCH",
      body: JSON.stringify({ isActive: want }),
    });
    showToast(want ? "Stall is now live" : "Stall taken offline");
    await load();
  } catch (err) {
    if (err.message !== "unauth") {
      alert(err.message);
      e.target.checked = !want; // revert
    }
  }
});

/* ===== notification prefs ===== */
$("savePrefsBtn")?.addEventListener("click", async () => {
  try {
    await api("/api/stall/account/notifications", {
      method: "PATCH",
      body: JSON.stringify({
        newOrders: $("prefNewOrders").checked,
        orderUpdates: $("prefOrderUpdates").checked,
        newReview: $("prefNewReview").checked,
        hygiene: $("prefHygiene").checked,
      }),
    });
    showToast("Preferences saved");
  } catch (err) {
    if (err.message !== "unauth") alert(err.message);
  }
});

/* ===== change password ===== */
$("changePwBtn")?.addEventListener("click", () => {
  openModal({
    title: "Change Password",
    primaryText: "Update Password",
    bodyHtml: `
      <div class="hpModalRow">
        <label class="hpModalLabel">Current Password</label>
        <input id="mCurPw" class="hpModalInput" type="password" />
      </div>
      <div class="hpModalRow">
        <label class="hpModalLabel">New Password</label>
        <input id="mNewPw" class="hpModalInput" type="password" placeholder="At least 8 characters" />
      </div>
      <div class="hpModalRow">
        <label class="hpModalLabel">Confirm New Password</label>
        <input id="mNewPw2" class="hpModalInput" type="password" />
      </div>
      <div class="hpModalErr" style="font-weight:800;"></div>`,
    onPrimary: async ({ overlay, close }) => {
      const cur = overlay.querySelector("#mCurPw").value;
      const nw = overlay.querySelector("#mNewPw").value;
      const nw2 = overlay.querySelector("#mNewPw2").value;

      if (!cur || !nw) return setErr(overlay, "All fields are required.");
      if (nw.length < 8)
        return setErr(overlay, "New password must be at least 8 characters.");
      if (nw !== nw2) return setErr(overlay, "New passwords do not match.");

      try {
        await api("/api/stall/account/password", {
          method: "PATCH",
          body: JSON.stringify({ currentPassword: cur, newPassword: nw }),
        });
        close();
        showToast("Password updated");
      } catch (err) {
        if (err.message !== "unauth") setErr(overlay, err.message);
      }
    },
  });
});

/* ===== deactivate account ===== */
$("deactivateBtn")?.addEventListener("click", () => {
  openModal({
    title: "Deactivate Account",
    primaryText: "Deactivate",
    bodyHtml: `
      <p style="font-weight:800; margin-bottom:8px;">This will:</p>
      <ul style="margin:0 0 14px 18px; font-size:14px; line-height:1.6;">
        <li>Take your stall offline immediately</li>
        <li>Sign you out</li>
        <li>Stop customers from placing new orders</li>
      </ul>
      <div class="hpModalRow">
        <label class="hpModalLabel">Enter your password to confirm</label>
        <input id="mDeactPw" class="hpModalInput" type="password" />
      </div>
      <div class="hpModalErr" style="font-weight:800;"></div>`,
    onPrimary: async ({ overlay, close }) => {
      const pw = overlay.querySelector("#mDeactPw").value;
      if (!pw) return setErr(overlay, "Password is required.");

      try {
        await api("/api/stall/account/deactivate", {
          method: "POST",
          body: JSON.stringify({ password: pw }),
        });
        close();
        alert("Your account has been deactivated.");
        location.href = "signin.html";
      } catch (err) {
        if (err.message !== "unauth") setErr(overlay, err.message);
      }
    },
  });
});

/* ===== logout ===== */
$("logoutBtn")?.addEventListener("click", () => {
  location.href = "signin.html";
});

/* =========================================================
   UI-only helpers (presentation, no data logic)
   Merged in from stall-account-ui.js.
   ========================================================= */

/* Live availability band mirrors the toggle's on/off state.
   Called from render() and safe to call anytime. */
function syncLiveBand(on) {
  const band = $("stallLiveBand");
  const icon = $("stallLiveIcon");
  const head = $("stallLiveHead");
  if (band) band.classList.toggle("isOffline", !on);
  if (icon)
    icon.className =
      "ti acctLiveIcon " + (on ? "ti-broadcast" : "ti-broadcast-off");
  if (head)
    head.textContent = on ? "Your stall is live" : "Your stall is offline";
}

/* Wire the collapsible opening-hours row + prep-time stat mirror.
   Runs once at boot; every lookup is guarded. */
function setupAccountUI() {
  // Collapsible opening hours
  const hoursToggle = $("hoursToggle");
  const hoursList = $("hoursList");
  if (hoursToggle && hoursList) {
    const toggleHours = () => {
      const open = hoursList.classList.toggle("open");
      hoursToggle.classList.toggle("open", open);
      hoursToggle.setAttribute("aria-expanded", String(open));
    };
    hoursToggle.addEventListener("click", toggleHours);
    hoursToggle.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleHours();
      }
    });
  }
}

/* ===== boot ===== */
setupAccountUI();
load();
