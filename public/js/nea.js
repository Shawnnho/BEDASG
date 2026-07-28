/*************************************************
 * nea.js
 * Talks to /api/nea/* instead of Firebase/Firestore.
 * Every write here also gets re-validated server-side (see
 * neaController.js) — this file is UI convenience only, not the
 * actual authorization boundary.
 *************************************************/

// Cache for stalls, now keyed by StallId (the real primary key) instead of
// the old Firestore "centres/{centreId}/stalls/{stallId}" path string.
let stallDataCache = {};

let inspectionsRaw = [];
let complaintsRaw = [];
let inspectionFilter = "all"; // all | upcoming | past
let complaintFilter = "all"; // all | new | under_review | resolved

let completingInspectionId = null;

function formatDateDMY(value) {
  if (!value) return "Unknown Date";
  const isPlainDate = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const d = new Date(isPlainDate ? `${value}T00:00:00` : value);
  if (isNaN(d)) return "Unknown Date";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

/* ---------- fetch helper ---------- */
async function api(path, options = {}) {
  const res = await AuthClient.apiFetch(`/api/nea${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

/* ---------- Helpers ---------- */
function todayMidnight() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function parseDateSafe(d) {
  if (!d) return null;
  const dt = new Date(`${d}T00:00:00`);
  return isNaN(dt.getTime()) ? null : dt;
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

function badgeForInspectionStatus(status) {
  const s = (status || "scheduled").toLowerCase();
  if (s === "completed") return `<span class="badge blue">Completed</span>`;
  if (s === "cancelled") return `<span class="badge red">Cancelled</span>`;
  return `<span class="badge green">Scheduled</span>`;
}

function badgeForComplaintStatus(status) {
  const s = (status || "new").toLowerCase();
  if (s === "resolved") return `<span class="badge blue">Resolved</span>`;
  if (s === "under_review")
    return `<span class="badge green">Under Review</span>`;
  return `<span class="badge red">New</span>`;
}

function markChipActive(prefixId, activeId) {
  document
    .querySelectorAll(`[id^="${prefixId}"]`)
    .forEach((b) => b.classList.remove("active"));
  const el = document.getElementById(activeId);
  if (el) el.classList.add("active");
}

function updateSidebarBadges() {
  const t0 = todayMidnight().getTime();
  const t7 = t0 + 7 * 24 * 60 * 60 * 1000;

  const upcomingCount = inspectionsRaw.filter((x) => {
    const st = (x.status || "scheduled").toLowerCase();
    if (st !== "scheduled") return false;
    const dt = parseDateSafe(x.date);
    if (!dt) return false;
    const tt = dt.getTime();
    return tt >= t0 && tt <= t7;
  }).length;

  const newComplaints = complaintsRaw.filter(
    (x) => (x.status || "new").toLowerCase() === "new",
  ).length;

  setBadge("badgeInspections", upcomingCount);
  setBadge("badgeComplaints", newComplaints);
}

/* --- TAB SWITCHING --- */
window.switchTab = (tabName) => {
  document
    .querySelectorAll(".nea-tab")
    .forEach((el) => el.classList.remove("active"));
  document
    .querySelectorAll(".nea-menu li")
    .forEach((el) => el.classList.remove("active"));

  const tab = document.getElementById(`tab-${tabName}`);
  if (tab) tab.classList.add("active");

  const index = ["inspections", "complaints", "grading"].indexOf(tabName);
  const li = document.querySelectorAll(".nea-menu li")[index];
  if (li) li.classList.add("active");

  if (tabName === "inspections") loadInspections();
  if (tabName === "complaints") loadComplaints();
  if (tabName === "grading") loadStallsForDropdowns();
};

/* ---------- INSPECTIONS ---------- */
window.setInspectionFilter = (mode) => {
  inspectionFilter = mode;
  markChipActive(
    "inspFilter",
    mode === "all"
      ? "inspFilterAll"
      : mode === "upcoming"
        ? "inspFilterUpcoming"
        : "inspFilterPast",
  );
  renderInspections();
};

async function loadInspections() {
  const list = document.getElementById("inspectionList");
  if (list) list.innerHTML = "<p>Loading inspections...</p>";

  try {
    inspectionsRaw = await api("/inspections");
    renderInspections();
    updateSidebarBadges();
  } catch (err) {
    console.error(err);
    if (list) list.innerHTML = "<p>No inspections found.</p>";
  }
}
window.loadInspections = loadInspections;

function statusFilterValue() {
  return (
    document.getElementById("inspectionFilter")?.value || "all"
  ).toLowerCase();
}

window.renderInspections = () => {
  const list = document.getElementById("inspectionList");
  if (!list) return;

  const q = (document.getElementById("inspSearch")?.value || "")
    .trim()
    .toLowerCase();
  const sortMode = document.getElementById("inspSort")?.value || "newest";
  const today = todayMidnight();
  const statusMode = statusFilterValue();

  let items = inspectionsRaw.slice();

  items = items.filter((x) => {
    const st = (x.status || "scheduled").toLowerCase();
    if (statusMode === "all") return true;
    return st === statusMode;
  });

  items = items.filter((x) => {
    const dt = parseDateSafe(x.date);
    if (!dt) return inspectionFilter === "all";
    if (inspectionFilter === "upcoming") return dt >= today;
    if (inspectionFilter === "past") return dt < today;
    return true;
  });

  if (q) {
    items = items.filter((x) => {
      const s1 = (x.stallName || "").toLowerCase();
      const s2 = (x.officer || "").toLowerCase();
      return s1.includes(q) || s2.includes(q);
    });
  }

  items.sort((a, b) => {
    const da = parseDateSafe(a.date)?.getTime() ?? 0;
    const dbt = parseDateSafe(b.date)?.getTime() ?? 0;
    return sortMode === "oldest" ? da - dbt : dbt - da;
  });

  if (items.length === 0) {
    list.innerHTML = "<p>No inspections found for this filter.</p>";
    return;
  }

  list.innerHTML = items
    .map((x) => {
      const st = (x.status || "scheduled").toLowerCase();
      const statusBadge = badgeForInspectionStatus(st);
      const dateText = formatDateDMY(x.date);

      let extra = "";
      if (st === "completed") {
        extra += `
          <div class="score-display" style="margin-top:8px;">
            <span>Score: ${x.score ?? "-"}/100</span>
            ${x.grade ? `<span class="badge blue">Grade ${x.grade}</span>` : ""}
          </div>
        `;
        if (x.remarks) {
          extra += `<p style="margin-top:8px; font-size:13px; color:#555;"><strong>Remarks:</strong> ${x.remarks}</p>`;
        }
        if (x.breakdown) {
          extra += `
            <details style="margin-top:8px;">
              <summary style="cursor:pointer; font-size:13px; color:#e67e22;">View Score Breakdown</summary>
              <div style="margin-top:8px; display:grid; gap:6px;">
                <div style="display:flex; justify-content:space-between;"><span>Food Hygiene</span><span>${x.breakdown.foodHygiene ?? 0}%</span></div>
                <div style="display:flex; justify-content:space-between;"><span>Personal Hygiene</span><span>${x.breakdown.personalHygiene ?? 0}%</span></div>
                <div style="display:flex; justify-content:space-between;"><span>Equipment</span><span>${x.breakdown.equipment ?? 0}%</span></div>
                <div style="display:flex; justify-content:space-between;"><span>Premises</span><span>${x.breakdown.premises ?? 0}%</span></div>
              </div>
            </details>
          `;
        }
      }
      const canAct = st === "scheduled";
      let actions = "";
      if (canAct) {
        actions = `
          <div class="actions-row">
            <button class="btn-mini primary" onclick="openCompleteModalForInspection('${x.id}')">Complete</button>
            <button class="btn-mini red" onclick="cancelInspection('${x.id}')">Cancel</button>
          </div>
        `;
      } else if (st === "cancelled") {
        actions = `
          <div class="actions-row">
            <button class="btn-mini red" onclick="deleteInspection('${x.id}')">Delete</button>
          </div>
        `;
      }

      return `
        <div class="nea-item">
          <div class="item-main">
            <h4>${x.stallName || "Unknown Stall"}</h4>
            ${statusBadge}
          </div>
          <p>Officer: ${x.officer || "-"}</p>
          <div class="item-meta">
            <span>Date: ${dateText}</span>
          </div>
          ${extra}
          ${actions}
        </div>
      `;
    })
    .join("");
};

window.cancelInspection = async (inspectionId) => {
  try {
    await api(`/inspections/${encodeURIComponent(inspectionId)}/cancel`, {
      method: "PUT",
    });
    await loadInspections();
  } catch (e) {
    console.error(e);
    alert("Could not cancel inspection.");
  }
};

window.deleteInspection = async (inspectionId) => {
  const sure = confirm(
    "Permanently delete this cancelled inspection? This cannot be undone.",
  );
  if (!sure) return;
 
  try {
    await api(`/inspections/${encodeURIComponent(inspectionId)}`, {
      method: "DELETE",
    });
    await loadInspections();
  } catch (e) {
    console.error(e);
    alert(e.message || "Could not delete inspection.");
  }
};

/* ---------- COMPLAINTS ---------- */
async function loadComplaints() {
  const list = document.getElementById("complaintList");
  if (list) list.innerHTML = "<p>Loading complaints...</p>";

  try {
    complaintsRaw = await api("/complaints");
    renderComplaints();
    updateSidebarBadges();
  } catch (err) {
    console.error(err);
    if (list) list.innerHTML = "<p>Error loading complaints.</p>";
  }
}
window.loadComplaints = loadComplaints;

window.setComplaintFilter = (mode) => {
  complaintFilter = mode;
  const map = {
    all: "cmpFilterAll",
    new: "cmpFilterNew",
    under_review: "cmpFilterUnder",
    resolved: "cmpFilterResolved",
  };
  markChipActive("cmpFilter", map[mode] || "cmpFilterAll");
  renderComplaints();
};

window.renderComplaints = () => {
  const list = document.getElementById("complaintList");
  if (!list) return;

  const q = (document.getElementById("cmpSearch")?.value || "")
    .trim()
    .toLowerCase();
  const sortMode = document.getElementById("cmpSort")?.value || "newest";

  let items = complaintsRaw.slice();

  items = items.filter((x) => {
    const st = (x.status || "new").toLowerCase();
    if (complaintFilter === "all") return true;
    return st === complaintFilter;
  });

  if (q) {
    items = items.filter((x) => {
      const s1 = (x.stallName || x.stall || "").toLowerCase();
      const s2 = (x.userName || "").toLowerCase();
      const s3 = (x.message || "").toLowerCase();
      return s1.includes(q) || s2.includes(q) || s3.includes(q);
    });
  }

  items.sort((a, b) => {
    const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dbt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return sortMode === "oldest" ? da - dbt : dbt - da;
  });

  if (items.length === 0) {
    list.innerHTML = "<p>No complaints found for this filter.</p>";
    return;
  }

  list.innerHTML = items
    .map((x) => {
      const date = formatDateDMY(x.createdAt);
      const imgHtml = x.imageUrl
        ? `<a href="${x.imageUrl}" target="_blank" class="evidence-link">View Evidence</a>`
        : "";

      const st = (x.status || "new").toLowerCase();
      const badge = badgeForComplaintStatus(st);

      let actions = "";
      if (st === "new") {
        actions = `
          <div class="actions-row">
            <button class="btn-mini gray" onclick="setComplaintStatus('${x.id}','under_review')">Mark Under Review</button>
            <button class="btn-mini primary" onclick="scheduleFromComplaint('${x.id}')">Schedule Inspection</button>
            <button class="btn-mini red" onclick="setComplaintStatus('${x.id}','resolved')">Resolve</button>
          </div>
        `;
      } else if (st === "under_review") {
        actions = `
          <div class="actions-row">
            <button class="btn-mini primary" onclick="scheduleFromComplaint('${x.id}')">Schedule Inspection</button>
            <button class="btn-mini red" onclick="setComplaintStatus('${x.id}','resolved')">Resolve</button>
          </div>
        `;
      } else {
        actions = `
          <div class="actions-row">
            <button class="btn-mini gray" onclick="setComplaintStatus('${x.id}','under_review')">Re-open</button>
          </div>
        `;
      }

      return `
        <div class="nea-item">
          <div class="item-main">
            <h4>${x.stallName || x.stall || "Unknown Stall"}</h4>
            ${badge}
          </div>
          <p><strong>${x.userName || "Anonymous"}:</strong> ${x.message || ""}</p>
          <div class="item-meta">
            <span>${date}</span>
            ${imgHtml}
          </div>
          ${actions}
        </div>
      `;
    })
    .join("");
};

window.setComplaintStatus = async (complaintId, newStatus) => {
  try {
    await api(`/complaints/${encodeURIComponent(complaintId)}/status`, {
      method: "PUT",
      body: JSON.stringify({ status: newStatus }),
    });
    await loadComplaints();
  } catch (e) {
    console.error(e);
    alert("Could not update complaint status.");
  }
};

window.scheduleFromComplaint = async (complaintId) => {
  const c = complaintsRaw.find((x) => x.id === complaintId);
  if (!c) return;

  openScheduleModal();

  const dateInput = document.getElementById("schDate");
  if (dateInput) {
    const t = todayMidnight();
    const yyyy = t.getFullYear();
    const mm = String(t.getMonth() + 1).padStart(2, "0");
    const dd = String(t.getDate()).padStart(2, "0");
    dateInput.value = `${yyyy}-${mm}-${dd}`;
  }

  const stallName = (c.stallName || c.stall || "").trim();
  const sel = document.getElementById("schStall");
  if (sel && stallName) {
    setTimeout(() => {
      const opts = Array.from(sel.options);
      const found = opts.find(
        (o) => (o.textContent || "").trim() === stallName,
      );
      if (found) sel.value = found.value;
    }, 200);
  }

  const st = (c.status || "new").toLowerCase();
  if (st === "new") {
    try {
      await api(`/complaints/${encodeURIComponent(complaintId)}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: "under_review" }),
      });
      await loadComplaints();
    } catch {}
  }
};

/* ---------- STALL SELECTOR + GRADING ---------- */
async function loadStallsForDropdowns() {
  const schSelect = document.getElementById("schStall");
  const gradeSelect = document.getElementById("gradeStallSelect");
  const compSelect = document.getElementById("compStall");

  const loadingOpt = '<option value="" disabled selected>Loading...</option>';
  if (schSelect) schSelect.innerHTML = loadingOpt;
  if (gradeSelect) gradeSelect.innerHTML = loadingOpt;
  if (compSelect) compSelect.innerHTML = loadingOpt;

  try {
    stallDataCache = {};
    let options = '<option value="" disabled selected>Select Stall</option>';

    const stalls = await api("/stalls");
    stalls.forEach((s) => {
      stallDataCache[s.StallId] = {
        name: s.StallName,
        hygieneGrade: s.HygieneGrade || "",
        stallId: s.StallId,
      };
      options += `<option value="${s.StallId}">${s.StallName}</option>`;
    });

    if (schSelect) schSelect.innerHTML = options;
    if (gradeSelect) gradeSelect.innerHTML = options;
    if (compSelect) compSelect.innerHTML = options;

    updateHygieneOverview();
    filterGradeDropdown();
  } catch (err) {
    console.error("Error loading stalls:", err);
  }
}

async function updateHygieneOverview() {
  try {
    const counts = await api("/grades/overview");
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(v);
    };
    set("ovTotal", counts.total);
    set("ovA", counts.A);
    set("ovB", counts.B);
    set("ovC", counts.C);
    set("ovD", counts.D);
    set("ovNone", counts.none);
  } catch (err) {
    console.error("Error loading grade overview:", err);
  }
}

window.filterGradeDropdown = () => {
  const q = (document.getElementById("gradeSearch")?.value || "")
    .trim()
    .toLowerCase();
  const sel = document.getElementById("gradeStallSelect");
  if (!sel) return;

  Array.from(sel.options).forEach((opt, idx) => {
    if (idx === 0) {
      opt.hidden = false;
      return;
    }
    const t = (opt.textContent || "").toLowerCase();
    opt.hidden = q ? !t.includes(q) : false;
  });
};

window.updateCurrentGradeDisplay = () => {
  const select = document.getElementById("gradeStallSelect");
  const display = document.getElementById("currentGradeDisplay");
  const stallId = select?.value;

  if (stallId && stallDataCache[stallId]) {
    const grade = stallDataCache[stallId].hygieneGrade;
    display.textContent = grade === "" || !grade ? "Not Graded" : grade;
  } else {
    display.textContent = "-";
  }
};

/* ---------- Scheduling ---------- */
window.openScheduleModal = () => {
  document.getElementById("scheduleModal").style.display = "flex";
  loadStallsForDropdowns();
};
window.closeScheduleModal = () => {
  document.getElementById("scheduleModal").style.display = "none";
};

window.submitSchedule = async () => {
  const stallSelect = document.getElementById("schStall");
  const date = document.getElementById("schDate").value;
  const officer = document.getElementById("schOfficer").value;

  if (!stallSelect.value || !date || !officer) {
    alert("Please fill all fields");
    return;
  }

  try {
    await api("/inspections", {
      method: "POST",
      body: JSON.stringify({ stallId: stallSelect.value, date, officer }),
    });

    closeScheduleModal();
    await loadInspections();
    alert("Inspection Scheduled!");
  } catch (err) {
    console.error(err);
    alert(err.message || "Error scheduling.");
  }
};

/* ---------- Grading ---------- */
// Grade is derived from a score, the same rule used everywhere else in the
// app (85+ = A, 70-84 = B, 55-69 = C, below 55 = D). There is no longer a
// way to pick a grade directly — that was the source of stalls showing a
// grade that had drifted out of sync with their actual inspection scores
// (or a grade with no inspection behind it at all).
window.previewGradeFromScore = () => {
  const input = document.getElementById("gradeScoreInput");
  const preview = document.getElementById("gradePreview");
  const score = Number(input.value);

  if (input.value === "" || !Number.isFinite(score) || score < 0 || score > 100) {
    preview.textContent = "—";
    preview.style.color = "#e67e22";
    return;
  }

  const grade = calculateGradeFromScore(score);
  preview.textContent = `${grade} (${score}/100)`;
  preview.style.color =
    grade === "A" ? "#16a34a" : grade === "B" ? "#2f6bff" : grade === "C" ? "#ca8a04" : "#dc2626";
};

window.submitGradeUpdate = async () => {
  const stallId = document.getElementById("gradeStallSelect").value;
  const scoreInput = document.getElementById("gradeScoreInput");
  const score = Number(scoreInput.value);
  const msg = document.getElementById("gradeMsg");

  if (!stallId || scoreInput.value === "" || !Number.isFinite(score) || score < 0 || score > 100) {
    alert("Select a stall and enter a score between 0 and 100.");
    return;
  }

  try {
    const updated = await api(`/stalls/${encodeURIComponent(stallId)}/grade`, {
      method: "PUT",
      body: JSON.stringify({ score }),
    });

    document.getElementById("currentGradeDisplay").textContent = updated.grade;

    if (stallDataCache[stallId]) {
      stallDataCache[stallId].hygieneGrade = updated.grade;
    }
    updateHygieneOverview();

    msg.style.color = "";
    msg.textContent = `Success: Grade updated to ${updated.grade} (score ${updated.score}/100)`;
    setTimeout(() => (msg.textContent = ""), 2500);
  } catch (err) {
    console.error("Error updating grade:", err);
    msg.style.color = "red";
    msg.textContent = "Error: Could not update grade.";
  }
};

/* ---------- COMPLETE INSPECTION ---------- */
function calculateGradeFromScore(score) {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  return "D";
}

function updateCalculatedGrade() {
  const score = parseInt(document.getElementById("compScore").value);
  const display = document.getElementById("compCalculatedGrade");

  if (isNaN(score)) {
    display.textContent = "-";
    display.style.color = "";
    return;
  }

  if (score < 0 || score > 100) {
    display.textContent = "Invalid (0-100)";
    display.style.color = "red";
    return;
  }

  // Preview only — the server recalculates this independently and
  // ignores whatever grade the client thinks it computed.
  const grade = calculateGradeFromScore(score);
  display.textContent = grade;

  if (grade === "A") display.style.color = "#16a34a";
  else if (grade === "B") display.style.color = "#2f6bff";
  else if (grade === "C") display.style.color = "#ca8a04";
  else display.style.color = "#dc2626";
}

window.openCompleteModal = () => {
  document.getElementById("completeModal").style.display = "flex";
  loadStallsForDropdowns();

  {
    const t = todayMidnight();
    const yyyy = t.getFullYear();
    const mm = String(t.getMonth() + 1).padStart(2, "0");
    const dd = String(t.getDate()).padStart(2, "0");
    document.getElementById("compDate").value = `${yyyy}-${mm}-${dd}`;
  }

  document.getElementById("compStall").value = "";
  document.getElementById("compOfficer").value = "";
  document.getElementById("compScore").value = "";
  document.getElementById("compFoodHygiene").value = "";
  document.getElementById("compPersonalHygiene").value = "";
  document.getElementById("compEquipment").value = "";
  document.getElementById("compPremises").value = "";
  document.getElementById("compRemarks").value = "";

  document.getElementById("compLicenseIssued").value = "";
  document.getElementById("compLicenseExpiry").value = "";

  document.getElementById("compCurrentGrade").textContent = "-";
  document.getElementById("compCalculatedGrade").textContent = "-";
  document.getElementById("compCalculatedGrade").style.color = "";

  document.getElementById("compScore").oninput = updateCalculatedGrade;

  completingInspectionId = null;
};

window.closeCompleteModal = () => {
  document.getElementById("completeModal").style.display = "none";
  completingInspectionId = null;
};

window.openCompleteModalForInspection = async (inspectionId) => {
  const ins = inspectionsRaw.find((x) => x.id === inspectionId);
  if (!ins) return;

  document.getElementById("completeModal").style.display = "flex";

  await loadStallsForDropdowns();

  document.getElementById("compStall").value = ins.stallId;
  document.getElementById("compDate").value = ins.date;
  document.getElementById("compOfficer").value = ins.officer || "";

  updateCurrentGradeForCompletion();
  completingInspectionId = inspectionId;

  document.getElementById("compScore").oninput = updateCalculatedGrade;
};

window.updateCurrentGradeForCompletion = () => {
  const select = document.getElementById("compStall");
  const display = document.getElementById("compCurrentGrade");
  const stallId = select?.value;

  if (stallId && stallDataCache[stallId]) {
    const grade = stallDataCache[stallId].hygieneGrade;
    display.textContent = grade === "" || !grade ? "Not Graded" : grade;
  } else {
    display.textContent = "-";
  }
};

window.submitCompletion = async () => {
  const stallId = document.getElementById("compStall").value;
  const date = document.getElementById("compDate").value;
  const officer = document.getElementById("compOfficer").value;

  const score = parseInt(document.getElementById("compScore").value);
  const foodHygiene =
    parseInt(document.getElementById("compFoodHygiene").value) || 0;
  const personalHygiene =
    parseInt(document.getElementById("compPersonalHygiene").value) || 0;
  const equipment =
    parseInt(document.getElementById("compEquipment").value) || 0;
  const premises = parseInt(document.getElementById("compPremises").value) || 0;
  const remarks = document.getElementById("compRemarks").value;

  if (!stallId || !date || !officer) {
    alert("Please fill in Stall, Date, and Officer Name.");
    return;
  }

  if (isNaN(score) || score < 0 || score > 100) {
    alert("Please enter a valid score between 0 and 100.");
    return;
  }

  if (!completingInspectionId) {
    alert(
      "Please complete an existing scheduled inspection (click Complete on a scheduled inspection).",
    );
    return;
  }

  const licIssuedStr = document.getElementById("compLicenseIssued").value;
  const licExpiryStr = document.getElementById("compLicenseExpiry").value;

  try {
    const updated = await api(
      `/inspections/${encodeURIComponent(completingInspectionId)}/complete`,
      {
        method: "PUT",
        body: JSON.stringify({
          officer,
          date,
          score,
          foodHygiene,
          personalHygiene,
          equipment,
          premises,
          remarks,
          licenseIssued: licIssuedStr || null,
          licenseExpiry: licExpiryStr || null,
        }),
      },
    );

    completingInspectionId = null;

    if (stallDataCache[stallId]) {
      stallDataCache[stallId].hygieneGrade = updated.grade;
    }
    updateHygieneOverview();

    window.closeCompleteModal();
    await loadInspections();

    alert(`Inspection completed! Grade: ${updated.grade} (${updated.score}/100)`);
  } catch (err) {
    console.error("Error completing inspection:", err);
    alert(err.message || "Error completing inspection. Please try again.");
  }
};

/* ---------- Init & Logout ---------- */
window.addEventListener("DOMContentLoaded", async () => {
  // Page guard: only nea_officer accounts get past this point. Note the
  // API itself enforces this independently too (see neaRoutes.js) — this
  // check is purely so a non-officer sees a redirect instead of a blank,
  // broken-looking dashboard full of 403 errors.
  const user = await AuthClient.getCurrentUser();
  if (!user || user.role !== "nea_officer") {
    window.location.href = "signin.html";
    return;
  }

  switchTab("inspections");
  await loadInspections();
  await loadComplaints();
});

window.logoutNEA = async () => {
  try {
    await AuthClient.logout();
    window.location.href = "index.html";
  } catch (err) {
    console.error("Logout failed:", err);
    alert("Error logging out. Please try again.");
  }
};
