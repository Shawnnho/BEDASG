

const API_BASE = "/api/operator";
const LOGIN_PAGE = "signin.html"; 

let CENTRES = [];
let SELECTED_CENTRE_ID = null;

let stallsRaw = [];
let rentalsRaw = [];
let currentBillMonthKey = null;

let stallFilter = "all";
let modalStalls = [];


async function apiFetch(path, options = {}) {
  const res = await AuthClient.apiFetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (res.status === 401 || res.status === 403) {
    window.location.href = LOGIN_PAGE;
    throw new Error("Not authorized.");
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
     
    }
    throw new Error(message);
  }

  if (res.status === 204) return null;
  return res.json();
}

const safeLower = (x) => String(x || "").toLowerCase();

function parseYMD(s) {
  const [y, m, d] = String(s || "")
    .split("-")
    .map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatYMD(dateObj) {
  if (!dateObj) return "-";
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function computeEndInclusiveFromStart(startYMD) {
  const start = parseYMD(startYMD);
  if (!start) return "-";
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  end.setDate(end.getDate() - 1);
  return formatYMD(end);
}

function setBadge(id, count) {
  const el = document.getElementById(id);
  if (!el) return;
  if (count > 0) {
    el.style.display = "grid";
    el.textContent = String(count);
  } else {
    el.style.display = "none";
  }
}

function markChipActive(prefixId, activeId) {
  document
    .querySelectorAll(`[id^="${prefixId}"]`)
    .forEach((b) => b.classList.remove("active"));
  const el = document.getElementById(activeId);
  if (el) el.classList.add("active");
}

function money(n) {
  const num = Number(n || 0);
  return num.toLocaleString(undefined, { style: "currency", currency: "SGD" });
}


function badgeForStallActive(active) {
  return active !== false
    ? `<span class="badge green">Active</span>`
    : `<span class="badge red">Inactive</span>`;
}

function centreNameById(id) {
  const c = CENTRES.find((x) => x.CentreId === id);
  return c?.Name || id;
}

document.addEventListener("DOMContentLoaded", async () => {
  const user = await AuthClient.getCurrentUser();

  if (!user || safeLower(user.role) !== "operator") {
    window.location.href = LOGIN_PAGE;
    return;
  }

  const opUserLine = document.getElementById("opUserLine");
  if (opUserLine) opUserLine.textContent = user.name || user.email || "Operator";

  try {
    await loadCentres();
    await updateOverview();
    renderCentres();
    switchTab("centres");
  } catch (err) {
    console.error("Dashboard init failed:", err);
    alert(`Failed to load dashboard: ${err.message}`);
  }
});

// Centres

async function loadCentres() {
  const sel = document.getElementById("centreSelect");
  if (sel) sel.innerHTML = `<option value="" disabled selected>Loading centres...</option>`;

  CENTRES = await apiFetch("/centres");

  if (!sel) return;

  if (CENTRES.length === 0) {
    sel.innerHTML = `<option value="" disabled selected>No centres assigned</option>`;
    setBadge("badgeCentres", 0);
    return;
  }

  let options = `<option value="" disabled selected>Select Centre</option>`;
  for (const c of CENTRES) {
    options += `<option value="${c.CentreId}">${c.Name || c.CentreId}</option>`;
  }
  sel.innerHTML = options;

  setBadge("badgeCentres", CENTRES.length);
}

window.onCentreChange = async () => {
  const sel = document.getElementById("centreSelect");
  SELECTED_CENTRE_ID = sel?.value || null;

  const title = document.getElementById("centreTitle");
  if (title) {
    title.textContent = SELECTED_CENTRE_ID
      ? `Centre — ${centreNameById(SELECTED_CENTRE_ID)}`
      : "Operator Dashboard";
  }

  try {
    await loadStalls();
    await loadRentals();
  } catch (err) {
    console.error("onCentreChange failed:", err);
    alert(`Failed to load centre data: ${err.message}`);
  }
};

// Tab switching

window.switchTab = async (tabName) => {
  document.querySelectorAll(".op-tab").forEach((el) => el.classList.remove("active"));
  document.querySelectorAll(".op-menu li").forEach((el) => el.classList.remove("active"));

  const tab = document.getElementById(`tab-${tabName}`);
  if (tab) tab.classList.add("active");

  const index = ["centres", "stalls", "rentals"].indexOf(tabName);
  const li = document.querySelectorAll(".op-menu li")[index];
  if (li) li.classList.add("active");

  if (tabName === "centres") {
    renderCentres();
    updateOverview();
    return;
  }

  if (!SELECTED_CENTRE_ID) return;

  try {
    if (tabName === "stalls") await loadStalls();
    if (tabName === "rentals") await loadRentals();
  } catch (err) {
    console.error(`switchTab(${tabName}) failed:`, err);
    alert(`Failed to load ${tabName}: ${err.message}`);
  }
};

// Centre UI (list + overview)

window.renderCentres = () => {
  const list = document.getElementById("centreList");
  if (!list) return;

  const q = safeLower(document.getElementById("centreSearch")?.value || "");
  const sortMode = document.getElementById("centreSort")?.value || "az";

  let items = CENTRES.slice();

  if (q) items = items.filter((c) => safeLower(c.Name || c.CentreId).includes(q));

  items.sort((a, b) => {
    const A = safeLower(a.Name || a.CentreId);
    const B = safeLower(b.Name || b.CentreId);
    if (sortMode === "za") return B.localeCompare(A);
    if (sortMode === "revenueDesc") return (b.Revenue || 0) - (a.Revenue || 0);
    if (sortMode === "revenueAsc") return (a.Revenue || 0) - (b.Revenue || 0);
    return A.localeCompare(B);
  });

  if (items.length === 0) {
    list.innerHTML = "<p>No centres found.</p>";
    return;
  }

  list.innerHTML = items
    .map((c) => {
      const name = c.Name || c.CentreId;
      const rev = money(c.Revenue || 0);

      return `
        <div class="op-item">
          <div class="item-main">
            <h4>${name}</h4>
            <span class="badge blue">Revenue: ${rev}</span>
          </div>
          <div class="actions-row">
            <button class="btn-mini primary" onclick="selectCentreAndGo('${c.CentreId}','stalls')">
              View Stalls
            </button>
            <button class="btn-mini gray" onclick="selectCentreAndGo('${c.CentreId}','rentals')">
              View Agreements
            </button>
          </div>
        </div>
      `;
    })
    .join("");
};

window.selectCentreAndGo = async (centreId, tab) => {
  SELECTED_CENTRE_ID = centreId;

  const sel = document.getElementById("centreSelect");
  if (sel) sel.value = centreId;

  const title = document.getElementById("centreTitle");
  if (title) title.textContent = `Centre — ${centreNameById(centreId)}`;

  try {
    if (tab === "stalls") await loadStalls();
    if (tab === "rentals") await loadRentals();
  } catch (err) {
    console.error("selectCentreAndGo failed:", err);
    alert(`Failed to load ${tab}: ${err.message}`);
  }

  switchTab(tab);
};

async function updateOverview() {
  const overview = await apiFetch("/overview");

  const setText = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(v);
  };

  setText("ovCentres", overview.centres);
  setText("ovRevenue", money(overview.totalRevenue));
  setText("ovStalls", overview.totalStalls);
  // No IsActive column on dbo.Stalls yet, so "active" == total for now.
  setText("ovActiveStalls", overview.totalStalls);
  setText("ovRentals", overview.totalRentals);

  setBadge("badgeStalls", overview.totalStalls);
  setBadge("badgeRentals", overview.totalRentals);
}

// Stalls (per selected centre)

async function loadStalls() {
  const list = document.getElementById("stallList");
  if (!SELECTED_CENTRE_ID) {
    if (list) list.innerHTML = "<p>Select a centre first.</p>";
    return;
  }
  if (list) list.innerHTML = "<p>Loading stalls...</p>";

  stallsRaw = await apiFetch(`/centres/${SELECTED_CENTRE_ID}/stalls`);
  renderStalls();
}

window.setStallFilter = (mode) => {
  stallFilter = mode;
  markChipActive(
    "stallFilter",
    mode === "all" ? "stallFilterAll" : mode === "active" ? "stallFilterActive" : "stallFilterInactive",
  );
  renderStalls();
};

window.renderStalls = () => {
  const list = document.getElementById("stallList");
  if (!list) return;

  const q = safeLower(document.getElementById("stallSearch")?.value || "");
  const sortMode = document.getElementById("stallSort")?.value || "az";

  let items = stallsRaw.slice();


  items = items.filter((s) => {
    const active = true;
    if (stallFilter === "active") return active;
    if (stallFilter === "inactive") return !active;
    return true;
  });

  if (q) {
    items = items.filter(
      (s) => safeLower(s.StallName).includes(q) || safeLower(s.Cuisine).includes(q),
    );
  }

  items.sort((a, b) => {
    const A = safeLower(a.StallName || a.StallId);
    const B = safeLower(b.StallName || b.StallId);
    return sortMode === "za" ? B.localeCompare(A) : A.localeCompare(B);
  });

  if (items.length === 0) {
    list.innerHTML = "<p>No stalls found.</p>";
    return;
  }

  list.innerHTML = items
    .map((s) => {
      return `
        <div class="op-item">
          <div class="item-main">
            <h4>${s.StallName || "Unnamed Stall"}</h4>
            ${badgeForStallActive(true)}
          </div>
          <p>Cuisine: ${s.Cuisine || "-"}</p>
          <div class="item-meta">
            <span>Location: <b>${s.Location || "—"}</b></span>
          </div>
        </div>
      `;
    })
    .join("");
};


async function loadRentals() {
  const list = document.getElementById("rentalList");
  if (!SELECTED_CENTRE_ID) {
    if (list) list.innerHTML = "<p>Select a centre first.</p>";
    return;
  }
  if (list) list.innerHTML = "<p>Loading agreements...</p>";

  const data = await apiFetch(`/centres/${SELECTED_CENTRE_ID}/rentals`);
  currentBillMonthKey = data.monthKey;
  rentalsRaw = data.agreements;

  renderRentals();
};

window.renderRentals = () => {
  const list = document.getElementById("rentalList");
  if (!list) return;

  const q = safeLower(document.getElementById("rentalSearch")?.value || "");
  const sortMode = document.getElementById("rentalSort")?.value || "newest";

  let items = rentalsRaw.slice();

  if (q) {
    items = items.filter((ra) => {
      return (
        safeLower(ra.OwnerName).includes(q) ||
        safeLower(ra.StallName).includes(q) ||
        safeLower(ra.StallId).includes(q)
      );
    });
  }

  items.sort((a, b) => {
    if (sortMode === "rentDesc") return Number(b.MonthlyRent || 0) - Number(a.MonthlyRent || 0);
    if (sortMode === "rentAsc") return Number(a.MonthlyRent || 0) - Number(b.MonthlyRent || 0);

    const A = new Date(a.CreatedAt).getTime() || 0;
    const B = new Date(b.CreatedAt).getTime() || 0;
    return sortMode === "oldest" ? A - B : B - A;
  });

  setBadge("badgeRentals", items.length);

  if (items.length === 0) {
    list.innerHTML = "<p>No rental agreements found.</p>";
    return;
  }

  list.innerHTML = items
    .map((ra) => {
      const start = ra.StartDate ? formatYMD(new Date(ra.StartDate)) : "-";
      const end = computeEndInclusiveFromStart(start);
      const bill = ra.bill || {};

      return `
        <div class="ra-card">
          <div class="ra-left">
            <h4>${ra.StallName || "Unknown Stall"}</h4>
            <p>Unit No: <b>${ra.UnitNo || "-"}</b></p>
            <p class="muted">Stall ID: <b>${ra.StallId || "-"}</b></p>
            <p class="muted">Owner: <b>${ra.OwnerName || "-"}</b></p>

            <div class="item-meta">
              <span>Start: ${start}</span>
              <span>End: ${end}</span>
            </div>

            <div class="actions-row">
              <button class="btn-mini danger" onclick="deleteRentalAgreement('${ra.AgreementId}')">
                Delete Agreement
              </button>
            </div>
          </div>

          <div class="ra-right">
            <div class="bill-panel">
              <div class="bill-title">Monthly Bill (${currentBillMonthKey})</div>

              <div class="bill-grid">
                <label class="bill-field bill-span-2">
                  <span>Rent</span>
                  <div class="bill-input-row">
                    <input id="rent-${ra.AgreementId}" type="number"
                      value="${Number(bill.RentAmount ?? ra.MonthlyRent ?? 0)}"
                      oninput="recomputeBillTotal('${ra.AgreementId}')" />
                    <small>/month</small>
                  </div>
                </label>

                <label class="bill-field">
                  <span>Utilities</span>
                  <input id="util-${ra.AgreementId}" type="number" value="${Number(bill.Utilities ?? 0)}"
                    oninput="recomputeBillTotal('${ra.AgreementId}')" />
                </label>

                <label class="bill-field">
                  <span>Cleaning</span>
                  <input id="clean-${ra.AgreementId}" type="number" value="${Number(bill.CleaningFee ?? 0)}"
                    oninput="recomputeBillTotal('${ra.AgreementId}')" />
                </label>

                <label class="bill-field">
                  <span>Penalty</span>
                  <input id="pen-${ra.AgreementId}" type="number" value="${Number(bill.Penalty ?? 0)}"
                    oninput="recomputeBillTotal('${ra.AgreementId}')" />
                </label>

                <label class="bill-field">
                  <span>Other</span>
                  <input id="other-${ra.AgreementId}" type="number" value="${Number(bill.OtherCharges ?? 0)}"
                    oninput="recomputeBillTotal('${ra.AgreementId}')" />
                </label>
              </div>

              <div class="bill-total">
                Total: <span id="total-${ra.AgreementId}">${money(bill.TotalAmount ?? ra.MonthlyRent ?? 0)}</span>
              </div>

              <button class="bill-save" onclick="saveMonthlyBill('${ra.StallId}', '${ra.AgreementId}')">
                Save Monthly Bill
              </button>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
};

window.recomputeBillTotal = (agreementId) => {
  const rent = Number(document.getElementById(`rent-${agreementId}`)?.value || 0);
  const utilities = Number(document.getElementById(`util-${agreementId}`)?.value || 0);
  const cleaningFee = Number(document.getElementById(`clean-${agreementId}`)?.value || 0);
  const penalty = Number(document.getElementById(`pen-${agreementId}`)?.value || 0);
  const other = Number(document.getElementById(`other-${agreementId}`)?.value || 0);

  const total = rent + utilities + cleaningFee + penalty + other;
  const el = document.getElementById(`total-${agreementId}`);
  if (el) el.textContent = money(total);
};

window.saveMonthlyBill = async (stallId, agreementId) => {
  try {
    const rent = Number(document.getElementById(`rent-${agreementId}`)?.value || 0);
    const utilities = Number(document.getElementById(`util-${agreementId}`)?.value || 0);
    const cleaningFee = Number(document.getElementById(`clean-${agreementId}`)?.value || 0);
    const penalty = Number(document.getElementById(`pen-${agreementId}`)?.value || 0);
    const other = Number(document.getElementById(`other-${agreementId}`)?.value || 0);

    await apiFetch(`/bills/${stallId}/${currentBillMonthKey}`, {
      method: "PUT",
      body: JSON.stringify({
        centreId: SELECTED_CENTRE_ID,
        rent,
        utilities,
        cleaningFee,
        penalty,
        other,
      }),
    });

    alert(`Saved operator bill for ${currentBillMonthKey} (Stall ${stallId})`);
  } catch (err) {
    console.error("SAVE BILL FAILED:", err);
    alert(`Save failed: ${err.message}`);
    return;
  }

  try {
    await loadRentals();
  } catch (err) {
    console.warn("Saved bill but refresh failed:", err.message);
  }
};

window.deleteRentalAgreement = async (agreementId) => {
  if (!confirm("Delete this rental agreement? This cannot be undone.")) return;

  try {
    await apiFetch(`/rentals/${agreementId}`, { method: "DELETE" });
  } catch (err) {
    console.error("DELETE RENTAL FAILED:", err);
    alert(`Delete failed: ${err.message}`);
    return;
  }

  try {
    await loadRentals();
  } catch (err) {
    console.warn("Deleted, but refresh failed:", err.message);
  }
};

// Add Rental Agreement (Modal)

window.openAddRentalModal = async () => {
  if (!SELECTED_CENTRE_ID) {
    alert("Select a centre first.");
    return;
  }

  const modal = document.getElementById("addRentalModal");
  if (modal) modal.style.display = "grid";

  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const startInput = document.getElementById("addRentalStartDate");
  if (startInput) startInput.value = `${y}-${m}-${day}`;

  ["addRentalUtilities", "addRentalCleaningFee", "addRentalPenalty", "addRentalOther"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = 0;
  });
  const rentInput = document.getElementById("addRentalMonthlyRent");
  if (rentInput) rentInput.value = "";
  recomputeAddRentalTotal();

  try {
    await loadStallsForModal();
  } catch (err) {
    console.error("loadStallsForModal failed:", err);
    alert(`Failed to load stalls: ${err.message}`);
  }
};

window.recomputeAddRentalTotal = () => {
  const rent = Number(document.getElementById("addRentalMonthlyRent")?.value || 0);
  const utilities = Number(document.getElementById("addRentalUtilities")?.value || 0);
  const cleaningFee = Number(document.getElementById("addRentalCleaningFee")?.value || 0);
  const penalty = Number(document.getElementById("addRentalPenalty")?.value || 0);
  const other = Number(document.getElementById("addRentalOther")?.value || 0);

  const total = rent + utilities + cleaningFee + penalty + other;
  const el = document.getElementById("addRentalTotal");
  if (el) el.textContent = money(total);
};

window.closeAddRentalModal = () => {
  const modal = document.getElementById("addRentalModal");
  if (modal) modal.style.display = "none";
};

async function loadStallsForModal() {
  const sel = document.getElementById("addRentalStallSelect");
  if (!sel) return;

  sel.innerHTML = `<option value="" disabled selected>Loading stalls...</option>`;

  modalStalls = await apiFetch(`/centres/${SELECTED_CENTRE_ID}/stalls`);

  if (modalStalls.length === 0) {
    sel.innerHTML = `<option value="" disabled selected>No stalls found for this centre</option>`;
    return;
  }

  sel.innerHTML = `<option value="" disabled selected>Select stall...</option>`;
  for (const s of modalStalls) {
    sel.innerHTML += `<option value="${s.StallId}">${s.StallName || s.StallId}</option>`;
  }


  sel.onchange = null;
}

window.createRentalAgreementFromModal = async () => {
  if (!SELECTED_CENTRE_ID) return;

  const sel = document.getElementById("addRentalStallSelect");
  const stallId = sel?.value;
  if (!stallId) {
    alert("Pick a stall first.");
    return;
  }

  const ownerName = document.getElementById("addRentalOwnerName")?.value?.trim() || "";
  const monthlyRent = Number(document.getElementById("addRentalMonthlyRent")?.value || 0);
  const startDate = document.getElementById("addRentalStartDate")?.value || "";
  const utilities = Number(document.getElementById("addRentalUtilities")?.value || 0);
  const cleaningFee = Number(document.getElementById("addRentalCleaningFee")?.value || 0);
  const penalty = Number(document.getElementById("addRentalPenalty")?.value || 0);
  const other = Number(document.getElementById("addRentalOther")?.value || 0);

  if (!ownerName) return alert("Owner name is required.");
  if (!startDate) return alert("Start date is required.");
  if (!Number.isFinite(monthlyRent) || monthlyRent < 0) {
    return alert("Monthly rent must be 0 or more.");
  }

  try {
    await apiFetch("/rentals", {
      method: "POST",
      body: JSON.stringify({
        centreId: SELECTED_CENTRE_ID,
        stallId,
        ownerName,
        monthlyRent,
        startDate,
        utilities,
        cleaningFee,
        penalty,
        other,
      }),
    });
  } catch (err) {
    console.error("CREATE RENTAL FAILED:", err);
    alert(`Create rental failed: ${err.message}`);
    return;
  }

  alert("Rental agreement created.");
  closeAddRentalModal();

  try {
    await loadRentals();
  } catch (err) {
    console.warn("Agreement created, but refresh failed:", err.message);
  }
};

// Logout

window.logoutOperator = async () => {
  await AuthClient.logout();
  window.location.href = LOGIN_PAGE;
};