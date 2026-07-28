// stall-hygiene.js — MSSQL/Express (no Firebase), cookie auth
// Locked to the logged-in stallholder's own stall — no stall picker.
// Talks to /api/stall/account (for identity + stallId) and /api/hygiene/*
// (for grade, license validity, upcoming inspection, and history/trend).

const API_BASE = "";
const $ = (id) => document.getElementById(id);

let currentStallId = null;

/* ===== helpers ===== */
async function api(path) {
  const res = await fetch(`${API_BASE}${path}`, { credentials: "include" });
  if (res.status === 401 || res.status === 403) {
    location.href = "signin.html";
    throw new Error("unauth");
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function setText(id, v) {
  const el = $(id);
  if (el) el.textContent = v ?? "—";
}

function getGradeColor(grade) {
  if (grade === "A") return "#16a34a";
  if (grade === "B") return "#2f6bff";
  if (grade === "C") return "#ca8a04";
  if (grade === "D") return "#dc2626";
  return "#6b7280"; // gray for unknown
}

function getGradeText(grade) {
  if (grade === "A") return "Excellent Hygiene Standards";
  if (grade === "B") return "Good Hygiene Standards";
  if (grade === "C") return "Average Hygiene Standards";
  if (grade === "D") return "Poor Hygiene Standards";
  return "Not yet inspected";
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

function setGradeUI(grade) {
  const g = grade || null;
  $("bigGrade").textContent = g || "—";
  $("gradeCard").style.backgroundColor = getGradeColor(g);
  $("gradeLabel").textContent = g ? getGradeText(g) : "No inspections yet";
}

function renderLicenseValidity(issued, expiry) {
  const licDays = $("licenseDays");
  const licStatus = $("licenseStatus");
  const licFill = $("licenseFill");
  const licIssue = $("issueDate");
  const licExpiry = $("expiryDate");

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
  const progressPct =
    totalDuration > 0
      ? Math.max(0, Math.min(100, (elapsed / totalDuration) * 100))
      : 0;

  licFill.style.width = `${progressPct}%`;
  licIssue.textContent = `Issued: ${formatDate(issued)}`;
  licExpiry.textContent = `Expired: ${formatDate(expiry)}`;
}

/* ===== chart + history (same layout/behaviour as hygiene.js) ===== */
function renderChart(trend) {
  const chartWrap = $("chartWrap");
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

  if (!trend.length) {
    if (empty) {
      empty.textContent = "No inspection records yet";
      empty.style.display = "block";
    }
    return;
  }
  if (empty) empty.style.display = "none";

  trend.forEach((t) => {
    const col = document.createElement("div");
    col.className = "chartCol";
    const bg = getGradeColor(t.grade);
    const heightPct = Math.max(0, Math.min(100, Number(t.score || 0)));
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
  const historyRows = $("historyRows");
  historyRows.innerHTML = "";

  if (!history.length) {
    historyRows.innerHTML =
      '<div class="emptyState" style="padding:18px; font-size:14px;">No inspection history available</div>';
    return;
  }

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

async function loadInspectionData(stallId) {
  const chartFooter = $("chartFooter");
  try {
    const inspections = await api(
      `/api/hygiene/stalls/${encodeURIComponent(stallId)}/inspections`,
    );

    if (!inspections.length) {
      renderChart([]);
      renderHistory([]);
      chartFooter.innerHTML = "";
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
      const changePct = previous ? Math.round((change / previous) * 100) : 0;

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

    return inspections[0];
  } catch (err) {
    if (err.message === "unauth") throw err;
    console.error("Error loading inspection data:", err);
    renderChart([]);
    renderHistory([]);
    chartFooter.innerHTML = "";
  }
}

/* ===== boot ===== */
async function load() {
  try {
    const acct = await api("/api/stall/account");

    setText("ownerName", acct.profile?.name || "Owner");

    const stall = acct.stall;
    if (!stall) {
      // Storeholder account with no stall set up yet — nothing to show.
      setText("stallName", "No stall linked");
      setGradeUI(null);
      renderLicenseValidity(null, null);
      renderChart([]);
      renderHistory([]);
      return;
    }

    currentStallId = stall.stallId;
    setText("stallName", stall.stallName || "—");

    const summary = await api(
      `/api/hygiene/stalls/${encodeURIComponent(stall.stallId)}`,
    );

    renderLicenseValidity(summary.licenseIssued, summary.licenseExpiry);

    const upcomingCard = $("upcomingCard");
    if (summary.upcoming) {
      setText(
        "upcomingDate",
        formatDate(summary.upcoming.DateTs || summary.upcoming.InspectionDate),
      );
      setText("upcomingOfficer", `Officer: ${summary.upcoming.OfficerName || "—"}`);
      upcomingCard.style.display = "block";
    } else {
      upcomingCard.style.display = "none";
    }

    const latestInspection = await loadInspectionData(stall.stallId);
    const finalGrade =
      latestInspection?.grade || summary.grade || stall.hygieneGrade || null;
    setGradeUI(finalGrade);
  } catch (err) {
    if (err.message !== "unauth") {
      console.error("stall-hygiene load error:", err);
      setGradeUI(null);
    }
  }
}

/* ===== events ===== */
$("viewHistoryBtn")?.addEventListener("click", () => {
  if (currentStallId) {
    window.location.href = `hygiene-history.html?id=${encodeURIComponent(currentStallId)}`;
  }
});

$("viewTrendBtn")?.addEventListener("click", () => {
  if (currentStallId) {
    window.location.href = `hygiene-trend.html?id=${encodeURIComponent(currentStallId)}`;
  }
});

$("logoutBtn")?.addEventListener("click", () => {
  location.href = "signin.html";
});

load();
