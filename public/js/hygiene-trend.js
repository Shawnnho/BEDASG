/*************************************************
 * hygiene-trend.js
 *************************************************/

let userRole = "customer";

function getGradeColor(grade) {
  if (grade === "A") return "#16a34a";
  if (grade === "B") return "#2f6bff";
  if (grade === "C") return "#ca8a04";
  if (grade === "D") return "#dc2626";
  return "#16a34a";
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

function calculateGrade(score) {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  return "D";
}

// Same fix as hygiene-history.js: "stall-hygiene.html" never existed.
function goBackSmart() {
  if (userRole === "storeholder") {
    window.location.href = "hygiene.html";
  } else {
    window.history.back();
  }
}

const stallImg = document.getElementById("stallImg");
const stallNameEl = document.getElementById("stallName");
const cgValue = document.getElementById("cgValue");
const chartWrap = document.getElementById("chartWrap");
const breakdownList = document.getElementById("breakdownList");
const chartFooter = document.querySelector(".chartFooter");
const avgCentreScoreLabel = document.getElementById("avgCentreScoreLabel");

const params = new URLSearchParams(window.location.search);
const id = params.get("id");

async function init() {
  if (!id) {
    window.location.href = "hygiene.html";
    return;
  }

  const user = await AuthClient.getCurrentUser();
  if (user) userRole = user.role || "customer";

  try {
    const res = await fetch(`/api/hygiene/stalls/${encodeURIComponent(id)}`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error("Stall not found");
    const s = await res.json();

    stallNameEl.textContent = s.name;
    stallImg.src = s.imageUrl || "images/stalls/placeholder.jpg";

    const inspRes = await fetch(
      `/api/hygiene/stalls/${encodeURIComponent(id)}/inspections`,
      { credentials: "include" },
    );
    const inspections = inspRes.ok ? await inspRes.json() : [];
    const latest = inspections[0]; // newest-first from the API
    const score = latest?.score ?? 78;
    const grade = s.grade || (latest ? latest.grade : "B");

    cgValue.textContent = `${grade} (${score}%)`;

    renderChart(inspections);
    renderBreakdown(latest?.breakdown);
    await renderMarketComparison(score);
  } catch (e) {
    console.error(e);
    stallNameEl.textContent = "Error loading stall";
  }
}

function renderChart(inspections) {
  const grid = chartWrap.querySelector(".chartGrid");
  chartWrap.innerHTML = "";
  if (grid) chartWrap.appendChild(grid);

  if (!inspections || inspections.length === 0) {
    chartWrap.innerHTML = '<p class="chartEmpty">No inspection records yet</p>';
    if (chartFooter) chartFooter.innerHTML = "";
    return;
  }

  // API returns newest-first; the chart wants oldest-first, last 5
  const trend = inspections.slice(0, 5).reverse();

  trend.forEach((insp) => {
    const date = new Date(insp.date);
    const year = String(date.getFullYear());
    const score = insp.score;
    const grade = insp.grade || calculateGrade(score);
    const bg = getGradeColor(grade);

    const col = document.createElement("div");
    col.className = "chartCol";
    col.innerHTML = `
      <div class="chartBar" style="height: ${score}%; background: ${bg}; width: 32px;">
        <div class="chartValue" style="bottom: 100%; margin-bottom: 6px; font-size:11px; color:#333;">${formatDate(insp.date)}</div>
      </div>
      <div class="chartLabel" style="font-size:13px; margin-top:8px;">${year}</div>
    `;
    chartWrap.appendChild(col);
  });

  if (trend.length >= 2) {
    const latest = trend[trend.length - 1].score;
    const previous = trend[trend.length - 2].score;
    const change = latest - previous;
    const changePct = previous ? Math.round((change / previous) * 100) : 0;

    if (chartFooter) {
      if (change > 0) {
        chartFooter.innerHTML = `<span style="color:#16a34a; font-weight:900;">▲ Score improved by ${Math.abs(changePct)}%</span> compared to last inspection.`;
      } else if (change < 0) {
        chartFooter.innerHTML = `<span style="color:#dc2626; font-weight:900;">▼ Score declined by ${Math.abs(changePct)}%</span> compared to last inspection.`;
      } else {
        chartFooter.innerHTML = `<span style="color:#6b7280; font-weight:900;">= Score unchanged</span> compared to last inspection.`;
      }
    }
  } else if (chartFooter) {
    chartFooter.innerHTML = "";
  }
}

function renderBreakdown(breakdown) {
  if (!breakdown) {
    breakdownList.innerHTML =
      '<p style="padding:20px; font-size:14px; color:#6b7280;">No detailed breakdown available</p>';
    return;
  }

  const categories = [
    { key: "foodHygiene", label: "Food Hygiene" },
    { key: "personalHygiene", label: "Personal Hygiene" },
    { key: "equipment", label: "Equipment" },
    { key: "premises", label: "Premises" },
  ];

  breakdownList.innerHTML = categories
    .map((cat) => {
      const score = breakdown[cat.key] || 0;
      const grade = calculateGrade(score);
      const color = getGradeColor(grade);

      return `
      <div class="bdRow">
        <div class="bdTop">
          <span class="bdLabel">${cat.label}</span>
          <span class="bdScore">${score}%</span>
        </div>
        <div class="bdTrack">
          <div class="bdFill" style="width: ${score}%; background: ${color};"></div>
        </div>
      </div>
    `;
    })
    .join("");
}

async function renderMarketComparison(stallScore) {
  try {
    const res = await fetch(
      `/api/hygiene/stalls/${encodeURIComponent(id)}/market`,
      { credentials: "include" },
    );
    const data = res.ok ? await res.json() : null;
    if (!data) throw new Error("Failed to load market comparison");
    updateMarketComparisonUI(
      data.ranking,
      data.percentile,
      data.avgScore,
      data.stallScore ?? stallScore,
      data.totalStalls,
    );
  } catch (e) {
    console.error("Error calculating market comparison:", e);
    updateMarketComparisonUI(null, null, null, null, 0);
  }
}

function updateMarketComparisonUI(
  ranking,
  percentile,
  avgScore,
  stallScore,
  totalStalls,
) {
  const mStatRanking = document.querySelector(".mStat");
  const mStatPercentile = document.querySelector(".mDivider + .mStat");
  const compBar = document.querySelector(".compBar");
  const compMarker = document.querySelector(".compMarker");
  const compVal = document.querySelector(".compVal");

  if (ranking === null || totalStalls < 2) {
    if (mStatRanking)
      mStatRanking.innerHTML =
        '<div class="mVal">—</div><div class="mLabel">Ranked</div>';
    if (mStatPercentile)
      mStatPercentile.innerHTML =
        '<div class="mVal">Insufficient data</div><div class="mLabel">Percentile</div>';
    return;
  }

  if (mStatRanking) {
    const rankClass = ranking <= 3 ? "bigGreen" : "";
    mStatRanking.innerHTML = `<div class="mVal ${rankClass}">#${ranking}</div><div class="mLabel">Ranked</div>`;
  }

  if (mStatPercentile) {
    const percentileClass = percentile >= 90 ? "bigGreen" : "";
    const percentileText =
      percentile >= 90
        ? "Top 10%"
        : percentile >= 50
          ? "Top 50%"
          : `Top ${100 - percentile}%`;
    mStatPercentile.innerHTML = `<div class="mVal ${percentileClass}">${percentileText}</div><div class="mLabel">Percentile</div>`;
  }

  if (compBar && compMarker && compVal) {
    compBar.style.width = `${avgScore}%`;
    compMarker.style.left = `${stallScore}%`;
    compVal.textContent = `${stallScore}%`;
    if (avgCentreScoreLabel) {
      avgCentreScoreLabel.textContent = `Average Centre Score: ${avgScore}%`;
    }
  }
}

document
  .getElementById("mobileBackBtn")
  ?.addEventListener("click", goBackSmart);

document.getElementById("deskBackBtn")?.addEventListener("click", (e) => {
  e.preventDefault();
  goBackSmart();
});

init();
