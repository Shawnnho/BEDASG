/*************************************************
 * hygiene-history.js
 *************************************************/

let userRole = "customer";
let allHistory = [];
let currentFilter = { q: "", year: "", grade: "" };

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

function generateRef(dateStr) {
  const date = new Date(dateStr);
  const year = String(date.getFullYear()).slice(-2);
  return `CE-${year}-${1000 + Math.floor(Math.random() * 9000)}`;
}

const stallImg = document.getElementById("stallImg");
const stallNameEl = document.getElementById("stallName");
const cgValue = document.getElementById("cgValue");
const tableBody = document.getElementById("tableBody");
const mobileList = document.getElementById("mobileList");
const recordCount = document.getElementById("recordCount");

const searchInput = document.getElementById("searchInput");
const yearSelect = document.getElementById("yearFilter");
const gradeSelect = document.getElementById("gradeFilter");
const pills = document.querySelectorAll(".hhPill");

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
    if (res.ok) {
      const s = await res.json();
      stallNameEl.textContent = s.name;
      stallImg.src = s.imageUrl || "images/stalls/placeholder.jpg";
      cgValue.textContent = s.grade;
    }
  } catch (e) {
    console.error(e);
    stallNameEl.textContent = "Error loading stall";
  }

  await loadInspectionData();
}

async function loadInspectionData() {
  try {
    const res = await fetch(
      `/api/hygiene/stalls/${encodeURIComponent(id)}/inspections`,
      { credentials: "include" },
    );
    const rows = res.ok ? await res.json() : [];

    allHistory = rows.map((insp) => {
      const dateObj = new Date(insp.date);
      return {
        dateObj,
        dateStr: formatDate(insp.date),
        score: insp.score,
        grade: insp.grade,
        remarks: insp.remarks,
        ref: generateRef(insp.date),
        officer: insp.officer || "NEA Officer",
        year: String(dateObj.getFullYear()),
      };
    });

    allHistory.sort((a, b) => b.dateObj - a.dateObj);

    if (allHistory[0]) {
      cgValue.textContent = `${allHistory[0].grade} (${allHistory[0].score}%)`;
    }

    render();
  } catch (e) {
    console.error("Error loading inspection data:", e);
    allHistory = [];
    render();
  }
}

function render() {
  const q = currentFilter.q.toLowerCase();

  const filtered = allHistory.filter((h) => {
    const matchQ =
      !q ||
      h.dateStr.toLowerCase().includes(q) ||
      h.remarks.toLowerCase().includes(q) ||
      h.ref.toLowerCase().includes(q);
    const matchYear = !currentFilter.year || h.year === currentFilter.year;
    const matchGrade = !currentFilter.grade || h.grade === currentFilter.grade;
    return matchQ && matchYear && matchGrade;
  });

  if (allHistory.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:30px; color:#6b7280;">No inspection records found</td></tr>`;
    mobileList.innerHTML = `<div style="text-align:center; padding:40px; color:#6b7280;">No inspection records found</div>`;
    recordCount.textContent = "Showing 0 of 0 records";
    return;
  }

  tableBody.innerHTML = filtered
    .slice(0, 8)
    .map((h) => {
      const badgeClass =
        h.grade === "A"
          ? "badgeGreen"
          : h.grade === "B"
            ? "badgeBlue"
            : h.grade === "C"
              ? "badgeOrange"
              : "badgeRed";
      return `
      <tr>
        <td><span style="font-weight:700">${h.dateStr}</span></td>
        <td><span style="font-weight:600">${h.score}/100</span></td>
        <td><span class="hhBadge ${badgeClass}">${h.grade}</span></td>
        <td>${h.remarks}</td>
      </tr>
    `;
    })
    .join("");

  mobileList.innerHTML = filtered
    .slice(0, 5)
    .map((h) => {
      const borderClass =
        h.grade === "A"
          ? "borderGreen"
          : h.grade === "B"
            ? "borderBlue"
            : h.grade === "C"
              ? "borderOrange"
              : "borderRed";
      const badgeClass =
        h.grade === "A"
          ? "badgeGreen"
          : h.grade === "B"
            ? "badgeBlue"
            : h.grade === "C"
              ? "badgeOrange"
              : "badgeRed";

      return `
      <div class="hhMobileCard ${borderClass}">
        <div class="mcHead">
          <div>
            <div class="mcDate">${h.dateStr}</div>
            <div class="mcRef">REF: ${h.ref}</div>
          </div>
          <div class="hhBadge ${badgeClass}">${h.grade}</div>
        </div>

        <div class="mcBody">${h.remarks}</div>

        <div class="mcDivider"></div>

        <div class="mcFoot">
          <div class="mcStat">
            <span class="mcLabel">Score</span>
            <span class="mcVal">${h.score}</span>
          </div>
          <div class="mcStat" style="text-align:right;">
            <span class="mcLabel">Officer</span>
            <span class="mcVal">${h.officer}</span>
          </div>
        </div>
      </div>
    `;
    })
    .join("");

  recordCount.textContent = `Showing ${Math.min(8, filtered.length)} of ${filtered.length} records`;
}

// The old code sent storeholders back to "stall-hygiene.html", a page that
// doesn't exist anywhere in the project — fixed to go back to the real
// selector page, "hygiene.html".
function goBackSmart() {
  if (userRole === "storeholder") {
    window.location.href = "hygiene.html";
  } else {
    window.history.back();
  }
}

searchInput.addEventListener("input", (e) => {
  currentFilter.q = e.target.value;
  render();
});

yearSelect.addEventListener("change", (e) => {
  currentFilter.year = e.target.value;
  render();
});
gradeSelect.addEventListener("change", (e) => {
  currentFilter.grade = e.target.value;
  render();
});

pills.forEach((btn) => {
  btn.addEventListener("click", () => {
    pills.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    const val = btn.dataset.filter;
    if (val === "all") {
      currentFilter.grade = "";
      currentFilter.year = "";
    } else if (val === "A" || val === "B" || val === "C") {
      currentFilter.grade = val;
      currentFilter.year = "";
    } else {
      currentFilter.year = val;
      currentFilter.grade = "";
    }
    render();
  });
});

document
  .getElementById("mobileBackBtn")
  ?.addEventListener("click", goBackSmart);

document.getElementById("deskBackBtn")?.addEventListener("click", (e) => {
  e.preventDefault();
  goBackSmart();
});

init();
