document.addEventListener("DOMContentLoaded", () => {
  // Claimed-state is fetched fresh from the server per logged-in user —
  // NOT from localStorage, since localStorage is shared across every
  // account that logs into this browser and would otherwise show one
  // account's claims as already-claimed on a completely different account.
  let claimedCodes = new Set();
  let claimedDailyIds = new Set();
  let currentUid = null;

  function todayKey() {
    const d = new Date();
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  const DAY = 24 * 60 * 60 * 1000;
  let promos = [];

  async function isGuestCheckLoggedIn() {
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) return false;
      const data = await res.json();
      currentUid = data?.user?.id || null;
      return true;
    } catch {
      return false;
    }
  }

  // Rebuilds claimedCodes/claimedDailyIds from the real UserPromoClaims
  // data for whoever is currently logged in. Called on load and again
  // after every successful claim/redeem so the UI stays in sync with
  // the database instead of a locally-cached guess.
  async function loadUserClaims() {
    claimedCodes = new Set();
    claimedDailyIds = new Set();

    if (!currentUid) return;

    try {
      const res = await fetch(`/api/promotions/${encodeURIComponent(currentUid)}`);
      if (!res.ok) return;
      const claims = await res.json();

      for (const c of claims) {
        const code = String(c.code || "").toUpperCase();
        if (!code) continue;

        claimedCodes.add(code);

        if (c.claimedAt) {
          const claimedDate = new Date(c.claimedAt);
          const yyyy = claimedDate.getUTCFullYear();
          const mm = String(claimedDate.getUTCMonth() + 1).padStart(2, "0");
          const dd = String(claimedDate.getUTCDate()).padStart(2, "0");
          claimedDailyIds.add(`${code}_${yyyy}-${mm}-${dd}`);
        }
      }
    } catch {
      // Leave both sets empty on failure — safer to show "Claim" than to
      // incorrectly show something as claimed.
    }
  }

  const promoList = document.getElementById("promoList");
  const promoSearch = document.getElementById("promoSearch");
  const typeFilter = document.getElementById("typeFilter");
  const statusFilter = document.getElementById("statusFilter");
  const sortFilter = document.getElementById("sortFilter");
  const promoSub = document.getElementById("promoSub");
  const redeemInput = document.getElementById("redeemInput");
  const redeemBtn = document.getElementById("redeemBtn");
  const redeemMsg = document.getElementById("redeemMsg");
  const toast = document.getElementById("promoToast");

  async function loadPromos() {
    try {
      await isGuestCheckLoggedIn();
      await loadUserClaims();

      const response = await fetch("/api/promotions");
      const data = await response.json();

      promos = data.map((item) => ({
        id: item.PromoCode || item.promoCode || item.Id || item.id || "",
        title:
          item.PromoTitle ||
          item.promoTitle ||
          item.title ||
          "Special Promotion",
        desc:
          item.Desc ||
          item.desc ||
          item.description ||
          "No description available.",
        code: item.PromoCode || item.promoCode || "NOCODE",
        img:
          item.ImageUrl ||
          item.imageUrl ||
          item.img ||
          "images/promo_placeholder.png",
        popular:
          item.IsPopular == 1 ||
          item.isPopular == 1 ||
          item.IsPopular === true ||
          item.isPopular === true,
        isHidden:
          item.IsHidden == 1 ||
          item.isHidden == 1 ||
          item.IsHidden === true ||
          item.isHidden === true,
        redemptionsLeft: item.RedemptionsLeft ?? item.redemptionsLeft,
        type: (item.PromoType || item.promoType || "cash").toLowerCase(),
        expiresAt: new Date(
          item.ExpiresAt || item.expiresAt || "2099-12-31",
        ).getTime(),
        claimOnce:
          item.ClaimOnce == 1 ||
          item.claimOnce == 1 ||
          item.ClaimOnce === true ||
          item.claimOnce === true,
      }));

      render();
    } catch (err) {
      promoList.innerHTML = `<div class="emptyState"><h2 class="emptyTitle">Error loading promotions</h2></div>`;
    }
  }

  function isExpired(p) {
    return Date.now() > p.expiresAt;
  }

  function daysLeft(p) {
    const ms = p.expiresAt - Date.now();
    return Math.ceil(ms / DAY);
  }

  function statusOf(p) {
    const d = daysLeft(p);
    if (d <= 0) return "expired";
    return d <= 7 ? "expiring" : "active";
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove("show"), 1400);
  }

  // Modal shown when a guest tries to claim/redeem a promo. Self-contained —
  // injects its own styles + DOM, no HTML/CSS changes needed.
  function showPromoLoginModal() {
    if (!document.getElementById("hpPromoModalStyles")) {
      const style = document.createElement("style");
      style.id = "hpPromoModalStyles";
      style.textContent = `
        .hpModalBackdrop{position:fixed;inset:0;background:rgba(40,25,15,.55);
          display:flex;align-items:center;justify-content:center;z-index:9999;
          animation:hpFade .15s ease}
        @keyframes hpFade{from{opacity:0}to{opacity:1}}
        .hpModalCard{background:#fffdf8;max-width:400px;width:calc(100% - 48px);
          box-sizing:border-box;margin:0 auto;
          border-radius:18px;padding:28px 26px 22px;box-shadow:0 20px 60px rgba(0,0,0,.3);
          font-family:inherit;text-align:center;animation:hpPop .18s ease}
        @keyframes hpPop{from{transform:scale(.94);opacity:0}to{transform:scale(1);opacity:1}}
        .hpModalIcon{width:52px;height:52px;border-radius:50%;margin:0 auto 14px;
          background:#fbe4d6;display:flex;align-items:center;justify-content:center;font-size:26px}
        .hpModalTitle{font-size:19px;font-weight:700;color:#7a3e1d;margin:0 0 8px}
        .hpModalMsg{font-size:15px;line-height:1.5;color:#4a3a2c;margin:0 0 20px}
        .hpModalActions{display:flex;gap:10px;justify-content:center;align-items:center;flex-wrap:wrap}
        .hpModalBtn{border:none;border-radius:12px;padding:11px 22px;font-size:15px;
          font-weight:600;cursor:pointer;font-family:inherit;transition:background .15s;
          display:inline-flex;align-items:center;justify-content:center;
          line-height:1;text-align:center;flex:0 0 auto;min-width:110px}
        .hpModalBtn.primary{background:#df8f3b;color:#fff}
        .hpModalBtn.primary:hover{background:#c97c2c}
        .hpModalBtn.ghost{background:#f0e6da;color:#7a3e1d}
        .hpModalBtn.ghost:hover{background:#e6d8c6}
      `;
      document.head.appendChild(style);
    }

    const backdrop = document.createElement("div");
    backdrop.className = "hpModalBackdrop";
    backdrop.innerHTML = `
      <div class="hpModalCard" role="dialog" aria-modal="true">
        <div class="hpModalIcon">&#128274;</div>
        <h3 class="hpModalTitle">Login to claim</h3>
        <p class="hpModalMsg">Promo codes are for members. Log in or sign up free to claim this deal.</p>
        <div class="hpModalActions">
          <button class="hpModalBtn ghost" data-close>Not now</button>
          <button class="hpModalBtn primary" data-login>Log in</button>
        </div>
      </div>`;

    const close = () => backdrop.remove();
    backdrop.addEventListener("click", (ev) => {
      if (ev.target === backdrop || ev.target.hasAttribute("data-close"))
        close();
      if (ev.target.hasAttribute("data-login"))
        window.location.href = "signin.html";
    });
    document.addEventListener("keydown", function onKey(ev) {
      if (ev.key === "Escape") {
        close();
        document.removeEventListener("keydown", onKey);
      }
    });

    document.body.appendChild(backdrop);
  }

  function isPromoRevealed(p) {
    const safeCode = String(p.code).toUpperCase();
    const dailyIdUpper = `${safeCode}_${todayKey()}`.toUpperCase();
    const isClaimed =
      p.claimOnce === false
        ? claimedDailyIds.has(dailyIdUpper)
        : claimedCodes.has(safeCode);
    const isApplied =
      localStorage.getItem("hawkerpoint_applied_promo") === safeCode;
    return p.isHidden && (isClaimed || isApplied);
  }

  function matches(p) {
    if (isExpired(p)) return false;

    if (p.isHidden && !isPromoRevealed(p)) return false;

    const q = (promoSearch.value || "").trim().toLowerCase();
    const t = typeFilter.value;
    const s = statusFilter.value;

    const titleStr = String(p.title).toLowerCase();
    const descStr = String(p.desc).toLowerCase();
    const codeStr = String(p.code).toLowerCase();

    const qOk =
      !q || titleStr.includes(q) || descStr.includes(q) || codeStr.includes(q);
    const tOk = t === "all" || p.type === t;
    const sOk = s === "all" || statusOf(p) === s;

    return qOk && tOk && sOk;
  }

  function sortPromos(arr) {
    const mode = sortFilter.value;

    return [...arr].sort((a, b) => {
      const aRevealed = isPromoRevealed(a);
      const bRevealed = isPromoRevealed(b);

      if (aRevealed && !bRevealed) return -1;
      if (!aRevealed && bRevealed) return 1;

      if (mode === "expSoon") {
        return daysLeft(a) - daysLeft(b);
      }
      if (mode === "best") {
        const score = (p) =>
          p.type === "percent" ? 3 : p.type === "cash" ? 2 : 1;
        return score(b) - score(a);
      }
      return (b.popular === true) - (a.popular === true);
    });
  }

  async function claimVoucher(codeRaw) {
    // Guests can view promos but not claim them.
    const loggedIn = await isGuestCheckLoggedIn();
    if (!loggedIn) {
      showPromoLoginModal();
      return;
    }

    const code = (codeRaw || "").trim().toUpperCase();
    const promo = promos.find((p) => String(p.code).toUpperCase() === code);

    if (!promo) return showToast("Promo not found");
    if (isExpired(promo)) return showToast("This promo is expired");

    try {
      const response = await fetch("/api/promotions/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promo.code }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          showPromoLoginModal();
          return;
        }
        if (response.status === 409) {
          showToast("You've already claimed this promo.");
          await loadPromos(); // sync the button state with reality
          return;
        }
        showToast(data.error || "Could not claim this code.");
        return;
      }

      showToast(`Claimed: ${code}`);
      await loadPromos(); // re-fetches claims + RedemptionsLeft from the real DB
    } catch (err) {
      showToast("An error occurred while claiming.");
    }
  }

  function renderCard(p) {
    const d = daysLeft(p);
    const exp = statusOf(p);

    const expText =
      d <= 0
        ? `<img src="images/cross.png" class="expIcon" alt="Expired" /> Expired`
        : d === 1
          ? `<img src="images/hour-glass.png" class="expIcon" alt="Expires soon" /> Expires in 1 day`
          : `<img src="images/hour-glass.png" class="expIcon" alt="Expires soon" /> Expires in ${d} days`;

    const redText =
      p.redemptionsLeft == null
        ? ""
        : `• <img src="images/voucher.png" class="redIcon" alt="Redemptions left" /> ${p.redemptionsLeft} left`;

    const safeCode = String(p.code);
    const codeUpper = safeCode.toUpperCase();
    const dailyIdUpper = `${codeUpper}_${todayKey()}`.toUpperCase();

    const isClaimed =
      p.claimOnce === false
        ? claimedDailyIds.has(dailyIdUpper)
        : claimedCodes.has(codeUpper);

    return `
    <article class="card">
      <div class="cardImg">
        <div class="imgFrame">
          ${p.img ? `<img src="${p.img}" alt="${p.title}">` : `<img src="images/promo_placeholder.png" alt="${p.title}">`}
        </div>
      </div>

      <div class="cardBody">
        <div class="cardTop">
          <h3 class="title">${p.title}</h3>
          ${p.popular ? `<span class="badgePopular">Hot Deal</span>` : ``}
        </div>

        <p class="desc">${p.desc}</p>

        <div class="promoChips">
          <span class="promoChip ${exp === "expiring" ? "expiring" : ""}">
            ${expText} ${redText}
          </span>
          <span class="promoChip">Type: ${p.type.toUpperCase()}</span>
        </div>

        <div class="cardBottom">
          <div class="promoCodeRow promoCodeRowFullWidth">
            <div class="promoCodeBox" data-codebox>${safeCode}</div>

            <button class="copyBtn" data-copy="${safeCode}">Copy</button>
            <button class="copyBtn" data-claim="${safeCode}" ${isClaimed ? "disabled" : ""}>
              ${isClaimed ? "Claimed ✓" : "Claim"}
            </button>
          </div>
        </div>
      </div>
    </article>
    `;
  }

  function renderEmpty() {
    promoList.innerHTML = `
    <div class="emptyState">
      <h2 class="emptyTitle">No promo codes found</h2>
      <div class="bottomReset">
        <button class="resetBtn" id="resetPromoBtn">Reset Filters</button>
      </div>
    </div>
    `;

    document.getElementById("resetPromoBtn").onclick = () => {
      promoSearch.value = "";
      typeFilter.value = "all";
      statusFilter.value = "all";
      sortFilter.value = "popular";
      render();
      showToast("Filters reset");
    };
  }

  function render() {
    const filtered = sortPromos(promos.filter(matches));

    const sortText = sortFilter.options[sortFilter.selectedIndex].text;
    promoSub.textContent = `Showing ${filtered.length} promo codes • Sorted by ${sortText.replace("Sort: ", "")}`;

    if (filtered.length === 0) return renderEmpty();

    promoList.innerHTML = filtered.map(renderCard).join("");
  }

  async function copyCode(code) {
    try {
      await navigator.clipboard.writeText(code);
      showToast(`Copied: ${code}`);
    } catch {
      const t = document.createElement("textarea");
      t.value = code;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
      showToast(`Copied: ${code}`);
    }
  }

  async function redeem(codeRaw) {
    const code = (codeRaw || "").trim().toUpperCase();
    redeemMsg.textContent = "";

    if (!code) {
      redeemMsg.textContent = "Please enter a promo code.";
      return;
    }

    const promo = promos.find((p) => String(p.code).toUpperCase() === code);

    if (!promo) {
      redeemMsg.textContent = "Invalid promo code.";
      showToast("Invalid code");
      return;
    }

    if (isExpired(promo)) {
      redeemMsg.textContent = "This promo code has expired.";
      showToast("Expired code");
      return;
    }

    try {
      const response = await fetch("/api/promotions/redeem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: promo.code }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          showPromoLoginModal();
          return;
        }
        if (response.status === 409) {
          redeemMsg.textContent = "You've already claimed this promo code.";
          showToast("Already claimed");
          await loadPromos(); // sync the button state with reality
          return;
        }
        redeemMsg.textContent = data.error || "Could not redeem this code.";
        showToast("Redemption failed");
        return;
      }

      localStorage.setItem("hawkerpoint_applied_promo", code);
      redeemMsg.textContent = `Applied: ${code} (saved for checkout)`;
      showToast(`Applied: ${code}`);

      loadPromos();
    } catch (error) {
      redeemMsg.textContent = "Error saving to database.";
      showToast("Redemption failed");
    }
  }

  promoSearch.addEventListener("input", render);
  typeFilter.addEventListener("change", render);
  statusFilter.addEventListener("change", render);
  sortFilter.addEventListener("change", render);

  promoList.addEventListener("click", (e) => {
    const copyBtn = e.target.closest("[data-copy]");
    if (copyBtn) return copyCode(copyBtn.dataset.copy);

    const claimBtn = e.target.closest("[data-claim]");
    if (claimBtn) return claimVoucher(claimBtn.dataset.claim);
  });

  redeemBtn.addEventListener("click", () => redeem(redeemInput.value));
  redeemInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") redeem(redeemInput.value);
  });

  loadPromos();
});