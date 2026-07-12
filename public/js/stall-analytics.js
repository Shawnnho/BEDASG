// stall-analytics.js — MSSQL/Express (no Firebase), cookie auth
// KPIs, sales chart (hand-drawn canvas), top dishes, ratings, hygiene.
// Chart drawing code reused verbatim from the Firebase version.

const API_BASE = "";
const $ = (id) => document.getElementById(id);

let latest = null; // last analytics payload

/* ===== helpers ===== */
function money(n) {
  const x = Number(n) || 0;
  return `$${x.toFixed(2)}`;
}

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

function setGradeColor(el, grade) {
  if (!el) return;
  const g = String(grade || "")
    .trim()
    .toUpperCase();
  el.textContent = g || "—";
  el.classList.remove("gradeA", "gradeB", "gradeC", "gradeD", "gradeNA");
  if (g === "A") el.classList.add("gradeA");
  else if (g === "B") el.classList.add("gradeB");
  else if (g === "C") el.classList.add("gradeC");
  else if (g === "D") el.classList.add("gradeD");
  else el.classList.add("gradeNA");
}

function starsText(avg) {
  const a = Number(avg) || 0;
  const full = Math.floor(a);
  const half = a - full >= 0.5;
  let s = "★".repeat(full);
  if (half) s += "½";
  return s.padEnd(5, "☆").slice(0, 5) || "☆☆☆☆☆";
}

function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString(undefined, { day: "numeric", month: "short" })
    : "—";
}

function daysUntil(v) {
  if (!v) return null;
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return null;
  const ms = d - new Date();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

async function api(path) {
  const res = await fetch(`${API_BASE}${path}`, { credentials: "include" });
  if (res.status === 401 || res.status === 403) {
    location.href = "signin.html";
    throw new Error("unauth");
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* ===== chart drawing (reused verbatim from the Firebase version) ===== */
function drawChart({ labels, today, yesterday, compare }) {
  const canvas = $("salesChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  //  measure the chart box (real layout), not the canvas itself
  const box = canvas.parentElement; // .anChartBox
  const rect = (box || canvas).getBoundingClientRect();

  const dpr = window.devicePixelRatio || 1;

  // CSS size
  const w = Math.max(10, rect.width);
  const h = Math.max(10, rect.height || 260);

  // backing store size
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);

  // draw in CSS pixels
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  // ===== SAFETY GUARDS =====
  if (!Array.isArray(labels)) labels = [];
  if (!Array.isArray(today)) today = [];
  if (!Array.isArray(yesterday)) yesterday = [];

  // if only 1 label (e.g. Today in DAILY mode), duplicate it so we can draw
  if (labels.length === 1) labels = [labels[0], labels[0]];
  if (today.length === 1) today = [today[0], today[0]];
  if (compare && yesterday.length === 1)
    yesterday = [yesterday[0], yesterday[0]];

  // if still empty, fallback
  if (labels.length < 2) labels = ["", ""];
  if (today.length < 2) today = [today[0] ?? 0, 0];
  if (compare && yesterday.length < 2) yesterday = [yesterday[0] ?? 0, 0];

  const allNowZero = (today || []).every((v) => Number(v) === 0);
  const allPrevZero =
    !compare || (yesterday || []).every((v) => Number(v) === 0);

  if (allNowZero && allPrevZero) {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("No sales in this period", w / 2, h / 2);
    ctx.textAlign = "left";
    return;
  }

  const padL = 50,
    padR = 60,
    padT = 20,
    padB = 95;
  const cw = w - padL - padR;
  const ch = h - padT - padB;

  const series = compare ? today.concat(yesterday) : today;
  const rawMax = Math.max(0, ...series);

  // nice axis: pad 10% and round to nearest 5
  const padded = rawMax * 1.1;
  const maxY = Math.max(10, Math.ceil(padded / 5) * 5);
  const minY = 0;

  // grid
  // grid (dotted) + LEFT y-axis labels
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 4]);

  for (let i = 0; i <= 4; i++) {
    const y = padT + (ch * i) / 4;

    // grid line
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + cw, y);
    ctx.stroke();

    // y-axis value
    const val = Math.round(maxY - (maxY * i) / 4);

    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "right"; // 👈 align right
    ctx.fillText(String(val), padL - 10, y + 5);
    ctx.setLineDash([2, 4]);
  }

  ctx.setLineDash([]);
  ctx.textAlign = "left";

  // x-axis + time labels (like 7AM 8AM 9AM...)
  const stepX = cw / Math.max(1, labels.length - 1);

  // detect hourly labels (your fmtLabel makes "AM/PM")
  const isHourly = labels.some((s) => /AM|PM/i.test(String(s)));

  // draw x-axis baseline
  const axisY = padT + ch + 10;
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(padL, axisY);
  ctx.lineTo(padL + cw, axisY);
  ctx.stroke();

  // labels + ticks
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";

  // for hourly, show more labels (like your screenshot)
  const skip = isHourly ? 1 : Math.max(1, Math.ceil(labels.length / 6));

  console.log("labels:", labels);
  labels.forEach((lab, i) => {
    if (i % skip !== 0 && i !== labels.length - 1) return;

    const x = padL + i * stepX;

    // tick mark
    ctx.beginPath();
    ctx.moveTo(x, axisY);
    ctx.lineTo(x, axisY + 6);
    ctx.stroke();

    // text under tick
    ctx.fillText(String(lab), x, axisY + 30);
  });

  ctx.textAlign = "left";

  //This is used for testing
  // ctx.fillStyle = "red";
  // ctx.font = "16px sans-serif";
  // ctx.fillText("TEST", 10, h - 10);

  function plot(values, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    values.forEach((v, i) => {
      const x = padL + i * stepX;
      const y = padT + ch - ((v - minY) / (maxY - minY)) * (ch * 0.9);

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  plot(today, "#e88e40");
  if (compare) plot(yesterday, "#2b66d9");
}

// =============================
// SAFE CHART REDRAW (MUST BE ABOVE USAGE)
// =============================
let lastChartArgs = null;

function drawChartSafe(args) {
  lastChartArgs = args;
  requestAnimationFrame(() => drawChart(args));
}

window.addEventListener("resize", () => {
  if (lastChartArgs) drawChartSafe(lastChartArgs);
});

// ========================
// Load inspection function
// ========================

/* ===== render ===== */
function renderKpis(d) {
  const k = d.kpis;
  const cmp = d.compare;
  const label = d.range.label;

  // Total sales
  setText("kpiSales", money(k.totalSales));
  setText("kpiSalesSub", label);

  // Orders
  setText("kpiOrders", String(k.orderCount));
  setText("kpiOrdersSub", label);

  // Revenue card doubles as the compare/delta card
  setText("kpiRevenue", money(k.totalSales));
  if (cmp) {
    const dp = cmp.deltas.sales;
    const sign = dp > 0 ? "+" : "";
    setText("kpiRevenueHint", `${sign}${dp}% vs previous`);
    setText("kpiRevenueSub", `Previous: ${money(cmp.kpis.totalSales)}`);
  } else {
    setText("kpiRevenueHint", label);
    setText("kpiRevenueSub", `${k.completedCount} completed`);
  }

  // Hygiene grade
  const grade = d.hygiene.lastInspection?.grade || "";
  setGradeColor($("kpiGrade"), grade);
  setText("kpiGradeWord", grade ? "Passed" : "No data");
  setText(
    "kpiGradeHint",
    d.hygiene.lastInspection
      ? `Last inspected ${fmtDate(d.hygiene.lastInspection.date)}`
      : "No completed inspections",
  );

  // Chart header
  setText("totalSales", money(k.totalSales));
  setText("totalSalesSub", label);

  // Mini cards
  setText("orderCountMini", String(k.orderCount));
  setText("orderWhenMini", label);
  setText("completionRate", `${k.completionRate}%`);

  // Hygiene mini card
  const next = d.hygiene.nextInspection;
  if (next) {
    const days = daysUntil(next.dateTs || next.date);
    setText("hygWhen", fmtDate(next.dateTs || next.date));
    setText(
      "hygHint",
      days != null && days >= 0
        ? `In ${days} day${days === 1 ? "" : "s"}`
        : "Scheduled",
    );
    setText("hygWord", "Scheduled");
  } else {
    setText("hygWhen", "—");
    setText("hygHint", "No upcoming inspection");
    setText("hygWord", grade ? "Passed" : "—");
  }
  setGradeColor($("hygGrade"), grade);
}

function renderTopDishes(rows) {
  const body = $("topDishesBody");
  if (!body) return;

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="4" style="padding:12px; color:rgba(0,0,0,.5);">No sales in this period.</td></tr>`;
    return;
  }

  body.innerHTML = rows
    .map(
      (r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(r.name)}</td>
        <td>${r.qty}</td>
        <td>${money(r.revenue)}</td>
      </tr>`,
    )
    .join("");
}

function renderRatings(r) {
  setText("ratingAvg", r.total > 0 ? r.avg.toFixed(1) : "—");
  setText("ratingStars", r.total > 0 ? starsText(r.avg) : "☆☆☆☆☆");

  const bars = $("ratingBars");
  if (!bars) return;

  const max = Math.max(1, ...Object.values(r.counts));

  bars.innerHTML = [5, 4, 3, 2, 1]
    .map((star) => {
      const n = r.counts[star] || 0;
      const pct = Math.round((n / max) * 100);
      return `
        <div class="anBarRow">
          <span class="anBarStar">${star}★</span>
          <span class="anBarTrack">
            <span class="anBarFill" style="width:${pct}%"></span>
          </span>
          <span class="anBarCount">${n}</span>
        </div>`;
    })
    .join("");
}

function render(d) {
  latest = d;

  setText("stallName", d.stallName);
  setText("ownerName", d.ownerName);
  setText("role", "Owner");

  renderKpis(d);
  renderTopDishes(d.topDishes || []);
  renderRatings(d.ratings);

  // Chart: map the endpoint's series onto drawChart's expected shape
  const labels = d.series.map((p) => p.label);
  const now = d.series.map((p) => p.sales);
  const prev = d.compare ? d.compare.series.map((p) => p.sales) : [];

  const compareOn = !!d.compare;
  setText(
    "legendCompareText",
    d.range.granularity === "hour" ? "Previous day" : "Previous period",
  );
  const dot = $("legendCompareDot");
  if (dot) dot.style.display = compareOn ? "" : "none";
  const legendTxt = $("legendCompareText");
  if (legendTxt) legendTxt.style.display = compareOn ? "" : "none";

  drawChartSafe({
    labels,
    today: now,
    yesterday: prev,
    compare: compareOn,
  });
}

/* ===== load ===== */
async function load() {
  const preset = $("datePreset")?.value || "today";
  const compare = !!$("compareToggle")?.checked;

  try {
    const d = await api(
      `/api/stall/analytics?preset=${encodeURIComponent(preset)}&compare=${compare}`,
    );
    render(d);
  } catch (err) {
    if (err.message !== "unauth") {
      console.error("analytics load error:", err);
    }
  }
}

/* ===== events ===== */
$("datePreset")?.addEventListener("change", load);
$("compareToggle")?.addEventListener("change", load);

$("viewDetailsBtn")?.addEventListener("click", () => {
  location.href = "stall-orders.html";
});

$("viewFeedbackBtn")?.addEventListener("click", () => {
  location.href = "stall-review.html";
});

$("logoutBtn")?.addEventListener("click", () => {
  location.href = "signin.html";
});

/* ===== boot ===== */
load();
