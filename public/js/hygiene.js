/*************************************************
 * hygiene.js
 * Talks to /api/hygiene/* instead of Firebase/Firestore.
 * AuthClient (authClient.js) tells us who's logged in via
 * the httpOnly session cookie — no client-side token handling needed.
 *************************************************/

let userRole = "customer";
let userStallId = null;

const stallSelect = document.getElementById("stallSelect");
const bigGrade = document.getElementById("bigGrade");
const gradeLabel = document.getElementById("gradeLabel");
const gradeCard = document.getElementById("gradeCard");

const licDays = document.getElementById("licenseDays");
const licStatus = document.getElementById("licenseStatus");
const licFill = document.getElementById("licenseFill");
const licIssue = document.getElementById("issueDate");
const licExpiry = document.getElementById("expiryDate");

const upcomingCard = document.getElementById("upcomingCard");
const upcomingDate = document.getElementById("upcomingDate");
const upcomingOfficer = document.getElementById("upcomingOfficer");

const chartWrap = document.getElementById("chartWrap");
const chartFooter = document.getElementById("chartFooter");
const historyRows = document.getElementById("historyRows");

const viewHistoryBtn = document.getElementById("viewHistoryBtn");
const viewTrendBtn = document.getElementById("viewTrendBtn");
const neaPortalBtn = document.getElementById("neaPortalBtn");

let currentStallId = null;
let stallsCache = [];

function getGradeColor(grade) {
  if (grade === "A") return "#16a34a";
  if (grade === "B") return "#2f6bff";
  if (grade === "C") return "#ca8a04";
  if (grade === "D") return "#dc2626";
  return "#16a34a";
}

function getGradeText(grade) {
  if (grade === "A") return "Excellent Hygiene Standards";
  if (grade === "B") return "Good Hygiene Standards";
  if (grade === "C") return "Average Hygiene Standards";
  if (grade === "D") return "Poor Hygiene Standards";
  return "Unknown";
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (isNaN(date)) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getLicenseDaysRemaining(expiry) {
  if (!expiry) return null;
  const now = new Date();
  const exp = new Date(expiry);
  return Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
}

function getLicenseStatus(daysRemaining) {
  if (daysRemaining === null) return { text: "Unknown", class: "" };
  if (daysRemaining < 0) return { text: "Expired", class: "expired" };
  if (daysRemaining <= 30) return { text: "Expiring Soon", class: "warning" };
  return { text: "Active", class: "active" };
}

function applyRoleSpecificUI() {
  if (userRole === "storeholder") {
    stallSelect?.closest(".selectCard")?.style.setProperty("display", "none");
  }
  if (userRole === "nea_officer" && neaPortalBtn) {
    neaPortalBtn.style.display = "inline-flex";
  }
}

async function loadStalls() {
  if (stallSelect) {
    stallSelect.innerHTML =
      '<option value="" disabled selected>Loading stalls...</option>';
  }

  const params = new URLSearchParams(window.location.search);
  let preselectId = params.get("id") || params.get("stallId");

  try {
    const res = await fetch("/api/hygiene/stalls", { credentials: "include" });
    stallsCache = res.ok ? await res.json() : [];
  } catch (err) {
    console.error("Error loading stalls:", err);
    stallsCache = [];
  }

  // For storeholders, /api/hygiene/stalls already only returns their own
  // stall(s) — the server enforces this, not just the UI.
  if (userRole === "storeholder" && stallsCache.length > 0) {
    userStallId = stallsCache[0].StallId;
    preselectId = userStallId;
  }

  if (stallSelect && userRole !== "storeholder") {
    stallSelect.innerHTML = `<option value="" disabled ${!preselectId ? "selected" : ""}>Select Stall</option>`;

    stallsCache.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.StallId;
      opt.textContent = s.StallName;
      opt.dataset.grade = s.HygieneGrade || "B";
      if (s.StallId === preselectId) opt.selected = true;
      stallSelect.appendChild(opt);
    });

    stallSelect.addEventListener("change", (e) => {
      const opt = stallSelect.options[stallSelect.selectedIndex];
      renderStallData(e.target.value, opt.dataset.grade);
    });
  }

  if (userRole === "storeholder" && stallsCache.length > 0) {
    renderStallData(userStallId, stallsCache[0].HygieneGrade || "B");
  } else if (preselectId) {
    const stall = stallsCache.find((s) => s.StallId === preselectId);
    if (stall) renderStallData(preselectId, stall.HygieneGrade || "B");
  }
}

async function renderStallData(stallId, currentGrade) {
  currentStallId = stallId;

  let summary = null;
  try {
    const res = await fetch(
      `/api/hygiene/stalls/${encodeURIComponent(stallId)}`,
      { credentials: "include" },
    );
    if (res.ok) summary = await res.json();
  } catch (err) {
    console.error("Error loading stall summary:", err);
  }

  const grade = summary?.grade || currentGrade || "B";
  bigGrade.textContent = grade;
  gradeCard.style.backgroundColor = getGradeColor(grade);
  gradeLabel.textContent = getGradeText(grade);

  renderLicenseValidity(summary?.licenseIssued, summary?.licenseExpiry);

  if (upcomingCard) {
    if (summary?.upcoming) {
      upcomingDate.textContent = formatDate(
        summary.upcoming.DateTs || summary.upcoming.InspectionDate,
      );
      upcomingOfficer.textContent = `Officer: ${summary.upcoming.OfficerName}`;
      upcomingCard.style.display = "block";
    } else {
      upcomingCard.style.display = "none";
    }
  }

  await loadInspectionData(stallId);
}

function renderLicenseValidity(issued, expiry) {
  if (!issued || !expiry) {
    licDays.textContent = "— Days";
    licStatus.textContent = "Unknown";
    licFill.style.width = "0%";
    licIssue.textContent = "Issued: —";
    licExpiry.textContent = "Expired: —";
    licStatus.className = "licenseTag";
    return;
  }

  const daysRemaining = getLicenseDaysRemaining(expiry);
  const status = getLicenseStatus(daysRemaining);

  licDays.textContent =
    daysRemaining >= 0
      ? `${daysRemaining} Days`
      : `${Math.abs(daysRemaining)} Days Overdue`;
  licStatus.textContent = status.text;
  licStatus.className = `licenseTag ${status.class}`;

  const now = new Date();
  const issuedDate = new Date(issued);
  const expiryDate = new Date(expiry);
  const totalDuration = expiryDate - issuedDate;
  const elapsed = now - issuedDate;
  const progressPct = Math.max(0, Math.min(100, (elapsed / totalDuration) * 100));

  licFill.style.width = `${progressPct}%`;
  licIssue.textContent = `Issued: ${formatDate(issued)}`;
  licExpiry.textContent = `Expired: ${formatDate(expiry)}`;
}

async function loadInspectionData(stallId) {
  try {
    const res = await fetch(
      `/api/hygiene/stalls/${encodeURIComponent(stallId)}/inspections`,
      { credentials: "include" },
    );
    const inspections = res.ok ? await res.json() : [];

    if (inspections.length === 0) {
      chartWrap.querySelectorAll(".chartCol").forEach((n) => n.remove());
      const empty = chartWrap.querySelector(".chartEmpty");
      if (empty) {
        empty.textContent = "No inspection records yet";
        empty.style.display = "block";
      }
      chartFooter.innerHTML = "";
      historyRows.innerHTML =
        '<div class="emptyState" style="padding:20px; font-size:14px;">No inspection history available</div>';
      return;
    }

    // API returns newest-first; the chart wants oldest-first, last 5
    const trendData = inspections
      .slice(0, 5)
      .reverse()
      .map((insp) => ({
        year: String(new Date(insp.date).getFullYear()),
        score: insp.score,
        grade: insp.grade,
      }));

    const historyData = inspections.map((insp) => ({
      date: formatDate(insp.date),
      score: insp.score,
      grade: insp.grade,
      remarks: insp.remarks,
    }));

    renderChart(trendData);
    renderHistory(historyData);

    if (inspections.length >= 2) {
      const latest = inspections[0].score;
      const previous = inspections[1].score;
      const change = latest - previous;
      const changePct = Math.round((change / previous) * 100);

      if (change > 0) {
        chartFooter.innerHTML = `<span style="color:#16a34a; font-weight:900;">▲ Score improved by ${Math.abs(changePct)}%</span> compared to last inspection.`;
      } else if (change < 0) {
        chartFooter.innerHTML = `<span style="color:#dc2626; font-weight:900;">▼ Score declined by ${Math.abs(changePct)}%</span> compared to last inspection.`;
      } else {
        chartFooter.innerHTML = `<span style="color:#6b7280; font-weight:900;">= Score unchanged</span> compared to last inspection.`;
      }
    } else {
      chartFooter.innerHTML = "";
    }
  } catch (err) {
    console.error("Error loading inspection data:", err);
    chartWrap.querySelectorAll(".chartCol").forEach((n) => n.remove());
    const empty = chartWrap.querySelector(".chartEmpty");
    if (empty) {
      empty.textContent = "Error loading inspection data";
      empty.style.display = "block";
    }
    chartFooter.innerHTML = "";
    historyRows.innerHTML =
      '<div class="emptyState" style="padding:20px; font-size:14px;">Error loading history</div>';
  }
}

function renderChart(trend) {
  let grid = chartWrap.querySelector(".chartGrid");
  if (!grid) {
    chartWrap.innerHTML = `
      <div class="chartGrid">
        <div class="chartLine"></div>
        <div class="chartLine"></div>
        <div class="chartLine"></div>
        <div class="chartLine"></div>
      </div>
      <p class="chartEmpty" style="display:none;"></p>
    `;
  }

  chartWrap.querySelectorAll(".chartCol").forEach((n) => n.remove());
  const empty = chartWrap.querySelector(".chartEmpty");
  if (empty) empty.style.display = "none";

  trend.forEach((t) => {
    const col = document.createElement("div");
    col.className = "chartCol";
    const bg = getGradeColor(t.grade);
    const heightPct = Number(t.score || 0);
    col.innerHTML = `
      <div class="chartBar" style="height: ${heightPct}%; background: ${bg};">
        <div class="chartValue" style="bottom: 100%; margin-bottom: 4px; color:${bg}">${t.year}</div>
      </div>
      <div class="chartLabel">${t.year}</div>
    `;
    chartWrap.appendChild(col);
  });
}

function renderHistory(history) {
  historyRows.innerHTML = "";
  history.forEach((h) => {
    const bg = getGradeColor(h.grade);
    const row = document.createElement("div");
    row.className = "histRow histDataRow";
    row.innerHTML = `
      <div>${h.date}</div>
      <div style="font-weight:700;">${h.score}/100</div>
      <div><div class="histGrade" style="background:${bg}">${h.grade}</div></div>
      <div style="font-size:13px; line-height:1.3; color:#444;">${h.remarks}</div>
    `;
    historyRows.appendChild(row);
  });
}

if (viewHistoryBtn) {
  viewHistoryBtn.addEventListener("click", () => {
    if (currentStallId) {
      window.location.href = `hygiene-history.html?id=${currentStallId}`;
    } else {
      alert("Please select a stall first.");
    }
  });
}

if (viewTrendBtn) {
  viewTrendBtn.addEventListener("click", () => {
    if (currentStallId) {
      window.location.href = `hygiene-trend.html?id=${currentStallId}`;
    } else {
      alert("Please select a stall first.");
    }
  });
}

if (neaPortalBtn) {
  neaPortalBtn.addEventListener("click", () => {
    window.location.href = "nea.html";
  });
}

(async function init() {
  const user = await AuthClient.getCurrentUser();
  if (user) {
    userRole = user.role || "customer";
    applyRoleSpecificUI();
  }
  await loadStalls();
})();
