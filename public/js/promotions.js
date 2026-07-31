document.addEventListener("DOMContentLoaded", () => {
  let claimedCodes = new Set(JSON.parse(localStorage.getItem("hp_claimedCodes") || "[]"));
  let claimedDailyIds = new Set(JSON.parse(localStorage.getItem("hp_claimedDailyIds") || "[]"));

  function todayKey() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  const DAY = 24 * 60 * 60 * 1000;
  let promos = [];

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
      const response = await fetch('/api/promotions');
      const data = await response.json();
      
      promos = data.map(item => ({
        id: item.PromoCode || item.promoCode || item.Id || item.id || "",
        title: item.PromoTitle || item.promoTitle || item.title || "Special Promotion",
        desc: item.Desc || item.desc || item.description || "No description available.",
        code: item.PromoCode || item.promoCode || "NOCODE",
        img: item.ImageUrl || item.imageUrl || item.img || "images/promo_placeholder.png",
        popular: item.IsPopular == 1 || item.isPopular == 1 || item.IsPopular === true || item.isPopular === true,
        isHidden: item.IsHidden == 1 || item.isHidden == 1 || item.IsHidden === true || item.isHidden === true,
        redemptionsLeft: item.RedemptionsLeft ?? item.redemptionsLeft,
        type: (item.PromoType || item.promoType || 'cash').toLowerCase(),
        expiresAt: new Date(item.ExpiresAt || item.expiresAt || '2099-12-31').getTime(),
        claimOnce: item.ClaimOnce == 1 || item.claimOnce == 1 || item.ClaimOnce === true || item.claimOnce === true
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

  function isPromoRevealed(p) {
    const safeCode = String(p.code).toUpperCase();
    const dailyIdUpper = `${safeCode}_${todayKey()}`.toUpperCase();
    const isClaimed = p.claimOnce === false ? claimedDailyIds.has(dailyIdUpper) : claimedCodes.has(safeCode);
    const isApplied = localStorage.getItem("hawkerpoint_applied_promo") === safeCode;
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

    const qOk = !q || titleStr.includes(q) || descStr.includes(q) || codeStr.includes(q);
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
        const score = (p) => p.type === "percent" ? 3 : p.type === "cash" ? 2 : 1;
        return score(b) - score(a);
      }
      return (b.popular === true) - (a.popular === true);
    });
  }

  async function claimVoucher(codeRaw) {
    const code = (codeRaw || "").trim().toUpperCase();
    const promo = promos.find((p) => String(p.code).toUpperCase() === code);

    if (!promo) return showToast("Promo not found");
    if (isExpired(promo)) return showToast("This promo is expired");

    try {
      const response = await fetch('/api/promotions/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promo.code })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          showToast("Please log in to claim promo codes.");
          return;
        }
        if (response.status === 409) {
          showToast("You've already claimed this promo.");
          return;
        }
        showToast(data.error || "Could not claim this code.");
        return;
      }

      const dailyIdUpper = `${code}_${todayKey()}`.toUpperCase();
      if (promo.claimOnce === false) {
        claimedDailyIds.add(dailyIdUpper);
        localStorage.setItem("hp_claimedDailyIds", JSON.stringify([...claimedDailyIds]));
      } else {
        claimedCodes.add(code);
        localStorage.setItem("hp_claimedCodes", JSON.stringify([...claimedCodes]));
      }

      showToast(`Claimed: ${code}`);
      await loadPromos(); // re-fetch so RedemptionsLeft reflects the real DB value
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

    const isClaimed = p.claimOnce === false ? claimedDailyIds.has(dailyIdUpper) : claimedCodes.has(codeUpper);

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
    promoSub.textContent = `Showing ${filtered.length} promo codes • Sorted by ${sortText.replace('Sort: ', '')}`;

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
      const response = await fetch('/api/promotions/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code: promo.code })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          redeemMsg.textContent = "Please log in to redeem promo codes.";
          showToast("Log in required");
          return;
        }
        if (response.status === 409) {
          redeemMsg.textContent = "You've already claimed this promo code.";
          showToast("Already claimed");
          return;
        }
        redeemMsg.textContent = data.error || "Could not redeem this code.";
        showToast("Redemption failed");
        return;
      }

      localStorage.setItem("hawkerpoint_applied_promo", code);
      redeemMsg.textContent = `Applied: ${code} (saved for checkout)`;
      showToast(`Applied: ${code}`);

      const dailyIdUpper = `${code}_${todayKey()}`.toUpperCase();
      if (promo.claimOnce === false) {
        claimedDailyIds.add(dailyIdUpper);
        localStorage.setItem("hp_claimedDailyIds", JSON.stringify([...claimedDailyIds]));
      } else {
        claimedCodes.add(code);
        localStorage.setItem("hp_claimedCodes", JSON.stringify([...claimedCodes]));
      }

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