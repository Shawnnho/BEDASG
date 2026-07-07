document.addEventListener("DOMContentLoaded", () => {
  // ---- MOCK USER CLAIMS (Locally stored for UI) ----
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

  // ---- DOM ----
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

  // ---- LOAD FROM SQL DATABASE ----
  async function loadPromos() {
    try {
      const response = await fetch('/api/promotions');
      const data = await response.json();
      
      // Map SQL columns exactly to what your Firebase code expected
      promos = data.map(item => ({
        id: item.PromoCode,
        title: item.PromoTitle,
        desc: item.Desc,
        code: item.PromoCode,
        img: item.ImageUrl,
        popular: item.IsPopular == 1 || item.IsPopular === true, // Handles SQL Bit or Int
        redemptionsLeft: item.RedemptionsLeft,
        type: item.PromoType ? item.PromoType.toLowerCase() : 'cash',
        expiresAt: new Date(item.ExpiresAt).getTime(),
        claimOnce: item.ClaimOnce == 1 || item.ClaimOnce === true
      }));
      
      render();
    } catch (err) {
      console.error("Failed to load promos:", err);
      promoList.innerHTML = `<div class="emptyState"><h2 class="emptyTitle">Error loading promotions</h2></div>`;
    }
  }

  // ---- EXPIRY HELPERS ----
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

  // ---- FILTERS ----
  function matches(p) {
    if (isExpired(p)) return false;

    const q = (promoSearch.value || "").trim().toLowerCase();
    const t = typeFilter.value;
    const s = statusFilter.value;

    const qOk = !q || p.title.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
    const tOk = t === "all" || p.type === t;
    const sOk = s === "all" || statusOf(p) === s;

    return qOk && tOk && sOk;
  }

  function sortPromos(arr) {
    const mode = sortFilter.value;
    if (mode === "expSoon") {
      return [...arr].sort((a, b) => daysLeft(a) - daysLeft(b));
    }
    if (mode === "best") {
      const score = (p) => p.type === "percent" ? 3 : p.type === "cash" ? 2 : 1;
      return [...arr].sort((a, b) => score(b) - score(a));
    }
    return [...arr].sort((a, b) => (b.popular === true) - (a.popular === true));
  }

  // ---- CLAIM VOUCHER LOGIC ----
  function claimVoucher(codeRaw) {
    const code = (codeRaw || "").trim().toUpperCase();
    const promo = promos.find((p) => p.code.toUpperCase() === code);

    if (!promo) return showToast("Promo not found");
    if (isExpired(promo)) return showToast("This promo is expired");

    const dailyIdUpper = `${code}_${todayKey()}`.toUpperCase();

    if (promo.claimOnce === false) {
      claimedDailyIds.add(dailyIdUpper);
      localStorage.setItem("hp_claimedDailyIds", JSON.stringify([...claimedDailyIds]));
    } else {
      claimedCodes.add(code);
      localStorage.setItem("hp_claimedCodes", JSON.stringify([...claimedCodes]));
    }

    render();
    showToast(`Claimed: ${code}`);
  }

  // ---- RENDER (YOUR EXACT FIREBASE TEMPLATE) ----
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

    const codeUpper = p.code.toUpperCase();
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
          <div class="promoCodeRow" style="width:100%;">
            <div class="promoCodeBox" data-codebox>${p.code}</div>

            <button class="copyBtn" data-copy="${p.code}">Copy</button>
            <button class="copyBtn" data-claim="${p.code}" ${isClaimed ? "disabled" : ""}>
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

  // ---- ACTIONS ----
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

  function redeem(codeRaw) {
    const code = (codeRaw || "").trim().toUpperCase();
    redeemMsg.textContent = "";

    if (!code) {
      redeemMsg.textContent = "Please enter a promo code.";
      return;
    }

    const promo = promos.find((p) => p.code.toUpperCase() === code);

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

    localStorage.setItem("hawkerpoint_applied_promo", code);
    redeemMsg.textContent = `Applied: ${code} (saved for checkout)`;
    showToast(`Applied: ${code}`);
  }

  // ---- EVENTS ----
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

  // INITIALIZE
  loadPromos();
});