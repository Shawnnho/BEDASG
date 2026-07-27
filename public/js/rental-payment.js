// Rental / operator payment page — talks to the MVC backend (no Firebase).
// The logged-in stall is resolved server-side from the auth cookie, so the
// frontend never sends a stallId.

const $ = (id) => document.getElementById(id);

/* ---------- small helpers ---------- */

function setText(id, v) {
  const el = $(id);
  if (el) el.textContent = v ?? "—";
}

function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "$0.00";
  return `$${x.toFixed(2)}`;
}

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function setStatus(msg, isError = false) {
  const el = $("statusMsg");
  if (!el) return;
  el.textContent = msg || "";
  el.style.color = isError ? "#b00020" : "rgba(0,0,0,.7)";
}

function monthKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthLabelFromKey(key) {
  const [y, m] = key.split("-");
  const dt = new Date(Number(y), Number(m) - 1, 1);
  return dt.toLocaleString(undefined, { month: "long", year: "numeric" });
}

function fmtDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function pill(el, text, tone) {
  if (!el) return;
  el.textContent = text;
  el.classList.remove("payPaid", "payUnpaid", "payOverdue", "payPartial");
  if (tone) el.classList.add(tone);
}

function computeOverdue(dueDate, isPaid) {
  if (!dueDate || isPaid) return false;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return false;
  return Date.now() > due.getTime();
}

function fillMonthSelect() {
  const sel = $("monthSelect");
  if (!sel) return;
  sel.innerHTML = "";

  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d);
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = monthLabelFromKey(key);
    sel.appendChild(opt);
  }
}

/* ---------- API layer ---------- */

async function apiGet(url) {
  const res = await fetch(url, { credentials: "include" });
  if (res.status === 401 || res.status === 403) {
    location.href = "signin.html";
    throw new Error("Not authenticated");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

async function apiPost(url, body) {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  if (res.status === 401 || res.status === 403) {
    location.href = "signin.html";
    throw new Error("Not authenticated");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/* ---------- rendering ---------- */

function renderStaffTable(rows) {
  const body = $("staffBody");
  if (!body) return;
  body.innerHTML = "";

  if (!rows || rows.length === 0) {
    body.innerHTML = `<tr>
      <td colspan="5" style="padding:12px; opacity:.8; font-weight:800;">
        No staff timesheets found for this month.
      </td>
    </tr>`;
    return;
  }

  for (const r of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="padding:10px; border-bottom:1px solid rgba(0,0,0,.08); font-weight:900;">${r.staffName}</td>
      <td style="padding:10px; border-bottom:1px solid rgba(0,0,0,.08); font-weight:800;">${safeNum(r.hours).toFixed(2)}</td>
      <td style="padding:10px; border-bottom:1px solid rgba(0,0,0,.08); font-weight:800;">${money(r.rate)} / hr</td>
      <td style="padding:10px; border-bottom:1px solid rgba(0,0,0,.08); font-weight:900;">${money(r.amount)}</td>
      <td style="padding:10px; border-bottom:1px solid rgba(0,0,0,.08); font-weight:900;">${r.status}</td>
    `;
    body.appendChild(tr);
  }
}

function renderPaymentHistory(rows) {
  const body = $("payHistBody");
  if (!body) return;
  body.innerHTML = "";

  if (!rows || rows.length === 0) {
    body.innerHTML = `<tr>
      <td colspan="5" style="padding:12px; opacity:.8; font-weight:800;">No payments yet.</td>
    </tr>`;
    return;
  }

  for (const p of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="padding:10px; border-bottom:1px solid rgba(0,0,0,.08); font-weight:800;">${fmtDate(p.createdAt)}</td>
      <td style="padding:10px; border-bottom:1px solid rgba(0,0,0,.08); font-weight:900;">${p.payTo === "operator" ? "Operator" : "Staff"}</td>
      <td style="padding:10px; border-bottom:1px solid rgba(0,0,0,.08); font-weight:900;">${money(p.amount)}</td>
      <td style="padding:10px; border-bottom:1px solid rgba(0,0,0,.08); font-weight:800;">${String(p.method || "—")}</td>
      <td style="padding:10px; border-bottom:1px solid rgba(0,0,0,.08); font-weight:800;">${String(p.note || "")}</td>
    `;
    body.appendChild(tr);
  }
}

/* ---------- rental notifications card ---------- */

function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
}

async function loadRentalNotifications() {
  const notifWrap = $("rentalNotifList");
  const histBody = $("rentalHistBody");
  const pill = $("rentalStatusPill");
  if (!notifWrap || !histBody) return; // card not on page

  let data;
  try {
    data = await apiGet("/api/rental/notifications");
  } catch (err) {
    notifWrap.innerHTML = `<div class="rnNone">Couldn't load notifications.</div>`;
    return;
  }

  // Status pill
  if (pill) {
    pill.classList.remove("rnPaid", "rnUnpaid", "rnOverdue");
    const cs = data.currentStatus;
    if (!data.hasBill || !cs) {
      pill.textContent = "No agreement";
      pill.classList.add("rnPaid");
    } else if (cs.isOverdue) {
      pill.textContent = "OVERDUE";
      pill.classList.add("rnOverdue");
    } else if (cs.status === "paid") {
      pill.textContent = "PAID";
      pill.classList.add("rnPaid");
    } else {
      pill.textContent = "UNPAID";
      pill.classList.add("rnUnpaid");
    }
  }

  // Active notifications
  if (!data.notifications || data.notifications.length === 0) {
    notifWrap.innerHTML = `<div class="rnNone">No active rental notifications. You're all paid up.</div>`;
  } else {
    notifWrap.innerHTML = data.notifications
      .map((n) => {
        const tone = n.severity === "overdue" ? "rnOverdue" : "";
        return `
          <div class="rnItem ${tone}">
            <div class="rnItemTitle">${esc(n.title)}</div>
            <div class="rnItemMsg">${esc(n.message)}</div>
          </div>`;
      })
      .join("");
  }

  // Rental payment history
  if (!data.history || data.history.length === 0) {
    histBody.innerHTML = `<tr><td colspan="4" style="padding:12px; opacity:.8; font-weight:800;">No rental payments yet.</td></tr>`;
  } else {
    histBody.innerHTML = data.history
      .map(
        (h) => `
        <tr>
          <td style="padding:10px; border-bottom:1px solid rgba(0,0,0,.08); font-weight:800;">${fmtDate(h.createdAt)}</td>
          <td style="padding:10px; border-bottom:1px solid rgba(0,0,0,.08); font-weight:800;">${esc(h.monthLabel || h.month)}</td>
          <td style="padding:10px; border-bottom:1px solid rgba(0,0,0,.08); font-weight:900;">${money(h.amount)}</td>
          <td style="padding:10px; border-bottom:1px solid rgba(0,0,0,.08); font-weight:800;">${esc(h.method || "—")}</td>
        </tr>`,
      )
      .join("");
  }
}

/* ---------- main load ---------- */

let currentSummary = null;

async function loadPaymentSummary() {
  const month = $("monthSelect")?.value || monthKey(new Date());
  setStatus("Loading payment summary…");

  const data = await apiGet(
    `/api/payments/summary?month=${encodeURIComponent(month)}`,
  );
  currentSummary = data;

  const { bill, staff, payments, totals } = data;

  setText("stallName", data.stall?.stallName || "—");
  setText("ownerName", data.stall?.ownerName || "—");

  // summary cards
  setText("operatorDueNum", money(totals.operatorDue));
  setText("staffDueNum", money(totals.staffDue));
  setText("grandDueNum", money(totals.grandDue));
  setText("paidThisMonthNum", money(totals.paidThisMonth));
  setText("operatorPaidLifetimeNum", money(totals.operatorPaidLifetime));

  // operator breakdown
  setText("rentLine", money(bill.rent));
  setText("utilitiesLine", money(bill.utilities));
  setText("cleaningLine", money(bill.cleaningFee));
  setText("penaltyLine", money(bill.penalty));
  setText("otherLine", money(bill.other));
  setText("operatorLine", money(totals.operatorDue));

  // staff breakdown (stubbed empty for now)
  setText("hoursLine", safeNum(staff.totalHours).toFixed(2));
  setText("staffLine", money(totals.staffDue));
  renderStaffTable(staff.rows);

  // payment history
  renderPaymentHistory(payments);

  // due date + late hint
  setText("dueDateLine", bill.dueDate ? fmtDate(bill.dueDate) : "—");
  const overdue = computeOverdue(bill.dueDate, bill.isPaid);
  const lateHint = $("lateHint");
  if (lateHint) {
    if (!bill.dueDate) lateHint.textContent = "No due date set for this month.";
    else if (bill.isPaid)
      lateHint.textContent = "✓ Paid — no further action needed.";
    else if (overdue)
      lateHint.textContent = "⚠ Overdue: late payment penalty may apply.";
    else lateHint.textContent = "Pay before due date to avoid penalties.";
  }

  // pills
  const monthPill = $("monthStatusPill");
  const operatorPill = $("operatorStatusPill");
  const staffPill = $("staffStatusPill");

  if (overdue && !bill.isPaid) pill(operatorPill, "OVERDUE", "payOverdue");
  else if (bill.isPaid) pill(operatorPill, "PAID", "payPaid");
  else pill(operatorPill, "UNPAID", "payUnpaid");

  // staff always unpaid/empty until the table exists
  if (staff.status === "Paid") pill(staffPill, "PAID", "payPaid");
  else if (staff.status === "Partial") pill(staffPill, "PARTIAL", "payPartial");
  else pill(staffPill, "UNPAID", "payUnpaid");

  const operatorDone = bill.isPaid;
  const staffDone = totals.staffDue === 0;
  if (operatorDone && staffDone) pill(monthPill, "ALL PAID", "payPaid");
  else if (overdue) pill(monthPill, "ACTION REQUIRED", "payOverdue");
  else pill(monthPill, "PENDING", "payUnpaid");

  // month delta not available from a single-month endpoint yet
  setText("deltaLine", "—");

  // Pay Center: show pay buttons when unpaid, collapse to paid row when paid.
  const payPanel = $("payPanel");
  const payPaidRow = $("payPaidRow");
  const pnBtn = $("payPaynowBtn");
  const bkBtn = $("payBankBtn");

  if (bill.isPaid) {
    if (payPanel) payPanel.style.display = "none";
    if (payPaidRow) payPaidRow.style.display = "flex";
    setText("payPaidText", `Bill paid for ${monthLabelFromKey(month)}`);
  } else {
    if (payPanel) payPanel.style.display = "";
    if (payPaidRow) payPaidRow.style.display = "none";
    const label = bill.total > 0 ? ` · ${money(bill.total)}` : "";
    if (pnBtn) {
      pnBtn.disabled = bill.total <= 0;
      pnBtn.textContent = `Pay via PayNow${label}`;
    }
    if (bkBtn) {
      bkBtn.disabled = bill.total <= 0;
      bkBtn.textContent = `Pay via Bank${label}`;
    }
  }

  setStatus(`Showing payments for ${monthLabelFromKey(month)}.`);
}

/* ---------- CSV export (from the loaded summary) ---------- */

function exportCSV() {
  const s = currentSummary;
  if (!s) return;

  const lines = [];
  lines.push(`Month,${s.month}`);
  lines.push("");
  lines.push("Operator Bill");
  lines.push("Rent,Utilities,Cleaning Fee,Penalty,Other,Total,Due Date,Status");
  lines.push(
    [
      s.bill.rent,
      s.bill.utilities,
      s.bill.cleaningFee,
      s.bill.penalty,
      s.bill.other,
      s.bill.total,
      s.bill.dueDate ? fmtDate(s.bill.dueDate) : "",
      s.bill.status || "",
    ].join(","),
  );

  lines.push("");
  lines.push("Staff Payroll");
  lines.push("Staff,Hours,Rate,Amount,Status");
  for (const r of s.staff.rows) {
    lines.push(
      [
        r.staffName,
        safeNum(r.hours).toFixed(2),
        safeNum(r.rate).toFixed(2),
        safeNum(r.amount).toFixed(2),
        r.status,
      ].join(","),
    );
  }

  lines.push("");
  lines.push("Payment History");
  lines.push("Date,Type,Amount,Method,Note");
  for (const p of s.payments) {
    lines.push(
      [
        p.createdAt ? fmtDate(p.createdAt) : "",
        p.payTo === "operator" ? "Operator" : "Staff",
        safeNum(p.amount).toFixed(2),
        p.method || "",
        (p.note || "").replaceAll(",", " "),
      ].join(","),
    );
  }

  const csv = lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `payments_${s.month}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function printPage() {
  window.print();
}

/* ---------- events ---------- */

$("logoutBtn")?.addEventListener("click", async () => {
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  } catch {}
  location.href = "signin.html";
});

$("refreshBtn")?.addEventListener("click", () => {
  loadPaymentSummary().catch((err) => {
    console.error(err);
    setStatus(`❌ ${err.message}`, true);
  });
});

$("monthSelect")?.addEventListener("change", () => {
  loadPaymentSummary().catch((err) => {
    console.error(err);
    setStatus(`❌ ${err.message}`, true);
  });
});

$("exportBtn")?.addEventListener("click", exportCSV);
$("printBtn")?.addEventListener("click", printPage);

async function payBillWith(method) {
  const note = ($("payNote")?.value || "").trim();
  const amount = currentSummary?.bill?.total || 0;
  const month =
    currentSummary?.month || $("monthSelect")?.value || monthKey(new Date());

  try {
    await showPaymentModal({ method, amount, label: "Monthly Bill" });
  } catch {
    setStatus("Payment cancelled.");
    return;
  }

  setStatus("Recording bill payment…");
  // Disable both buttons during processing.
  const pn = $("payPaynowBtn");
  const bk = $("payBankBtn");
  if (pn) pn.disabled = true;
  if (bk) bk.disabled = true;

  try {
    const res = await apiPost("/api/rental/pay", { method, note, month });
    setStatus(
      `✅ Bill paid: ${money(res.amount)} for ${res.month}. Access restored.`,
    );
    await loadRentalNotifications();
    await loadPaymentSummary();
  } catch (err) {
    console.error(err);
    setStatus(`❌ Bill payment failed: ${err.message}`, true);
    if (pn) pn.disabled = false;
    if (bk) bk.disabled = false;
  }
}

$("payPaynowBtn")?.addEventListener("click", () => payBillWith("paynow"));
$("payBankBtn")?.addEventListener("click", () => payBillWith("bank"));

// Collapse / expand the Rental Notifications card.
function toggleRentalNotif() {
  const toggle = $("rentalNotifToggle");
  const body = $("rentalNotifBody");
  if (!toggle || !body) return;
  const collapsed = toggle.classList.toggle("collapsed");
  body.style.display = collapsed ? "none" : "";
  toggle.setAttribute("aria-expanded", String(!collapsed));
}
$("rentalNotifToggle")?.addEventListener("click", toggleRentalNotif);
$("rentalNotifToggle")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    toggleRentalNotif();
  }
});

/* ---------- init ---------- */

fillMonthSelect();
loadPaymentSummary().catch((err) => {
  console.error(err);
  if (err.message !== "Not authenticated") {
    setStatus(`❌ Failed to load payments: ${err.message}`, true);
  }
});
loadRentalNotifications();
