const analyticsModel = require("../models/stallAnalyticsModel");
const orderModel = require("../models/orderModel"); // reuse getUserInfo / getStallName

/* ===== date helpers (server-local time) ===== */

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

// Resolve a preset into { start, end, granularity, label }
function rangeFromPreset(preset) {
  const now = new Date();
  const p = String(preset || "today").toLowerCase();

  if (p === "alltime") {
    return {
      start: new Date(2000, 0, 1),
      end: endOfDay(now),
      granularity: "day",
      label: "All time",
    };
  }

  if (p === "yesterday") {
    const y = addDays(now, -1);
    return {
      start: startOfDay(y),
      end: endOfDay(y),
      granularity: "hour",
      label: "Yesterday",
    };
  }

  if (p === "last7") {
    return {
      start: startOfDay(addDays(now, -6)),
      end: endOfDay(now),
      granularity: "day",
      label: "Last 7 days",
    };
  }

  if (p === "last30") {
    return {
      start: startOfDay(addDays(now, -29)),
      end: endOfDay(now),
      granularity: "day",
      label: "Last 30 days",
    };
  }

  if (p === "thismonth") {
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      start: startOfDay(s),
      end: endOfDay(now),
      granularity: "day",
      label: "This month",
    };
  }

  if (p === "lastmonth") {
    const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const e = new Date(now.getFullYear(), now.getMonth(), 0); // last day of prev month
    return {
      start: startOfDay(s),
      end: endOfDay(e),
      granularity: "day",
      label: "Last month",
    };
  }

  // default: today
  return {
    start: startOfDay(now),
    end: endOfDay(now),
    granularity: "hour",
    label: "Today",
  };
}

// The comparison window: the same-length period immediately before `range`
function comparisonRange(range) {
  const msDay = 24 * 60 * 60 * 1000;
  const spanDays =
    Math.round((startOfDay(range.end) - startOfDay(range.start)) / msDay) + 1;

  const prevEnd = endOfDay(addDays(range.start, -1));
  const prevStart = startOfDay(addDays(range.start, -spanDays));

  return { start: prevStart, end: prevEnd, granularity: range.granularity };
}

/* ===== series shaping ===== */

// Fill missing hours so the chart has a continuous 0–23 axis
function fillHours(rows) {
  const byHour = new Map(rows.map((r) => [r.bucket, r]));
  const out = [];
  for (let h = 0; h < 24; h++) {
    const r = byHour.get(h);
    out.push({
      label: `${String(h).padStart(2, "0")}:00`,
      sales: r ? r.sales : 0,
      orders: r ? r.orders : 0,
    });
  }
  return out;
}

// Fill missing days across the range
function fillDays(rows, start, end) {
  const key = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const byDay = new Map(
    rows.map((r) => {
      const d = new Date(r.bucket);
      return [key(d), r];
    }),
  );

  const out = [];
  let cur = startOfDay(start);
  const last = startOfDay(end);

  while (cur <= last) {
    const r = byDay.get(key(cur));
    out.push({
      label: `${cur.getDate()}/${cur.getMonth() + 1}`,
      sales: r ? r.sales : 0,
      orders: r ? r.orders : 0,
    });
    cur = addDays(cur, 1);
  }
  return out;
}

async function buildSeries(stallId, range) {
  if (range.granularity === "hour") {
    const rows = await analyticsModel.getHourlySales(
      stallId,
      range.start,
      range.end,
    );
    return fillHours(rows);
  }
  const rows = await analyticsModel.getDailySales(
    stallId,
    range.start,
    range.end,
  );
  return fillDays(rows, range.start, range.end);
}

/* ===== GET /api/stall/analytics?preset=today&compare=true ===== */

async function getAnalytics(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });

    const user = await orderModel.getUserInfo(userId);
    if (!user?.StallId) {
      return res.status(404).json({ error: "No stall linked to this user" });
    }
    const stallId = user.StallId;
    const stallName = await orderModel.getStallName(stallId);

    const preset = req.query.preset || "today";
    const compare = String(req.query.compare) === "true";

    const range = rangeFromPreset(preset);

    // Everything for the selected window
    const [kpis, series, topDishes, ratings, hygiene] = await Promise.all([
      analyticsModel.getKpis(stallId, range.start, range.end),
      buildSeries(stallId, range),
      analyticsModel.getTopDishes(stallId, range.start, range.end, 5),
      analyticsModel.getRatings(stallId),
      analyticsModel.getHygiene(stallId),
    ]);

    // Optional comparison window (previous equal-length period)
    let compareData = null;
    if (compare) {
      const prev = comparisonRange(range);
      const [prevKpis, prevSeries] = await Promise.all([
        analyticsModel.getKpis(stallId, prev.start, prev.end),
        buildSeries(stallId, prev),
      ]);

      const delta = (now, before) => {
        if (!before) return now > 0 ? 100 : 0;
        return Math.round(((now - before) / before) * 100);
      };

      compareData = {
        kpis: prevKpis,
        series: prevSeries,
        deltas: {
          sales: delta(kpis.totalSales, prevKpis.totalSales),
          orders: delta(kpis.orderCount, prevKpis.orderCount),
        },
      };
    }

    res.json({
      stallName: stallName || "—",
      ownerName: user.Name || "Owner",
      range: {
        preset,
        label: range.label,
        granularity: range.granularity,
        start: range.start,
        end: range.end,
      },
      kpis,
      series,
      topDishes,
      ratings,
      hygiene,
      compare: compareData,
    });
  } catch (err) {
    console.error("getAnalytics error:", err);
    res.status(500).json({ error: "Failed to load analytics" });
  }
}

module.exports = { getAnalytics };
