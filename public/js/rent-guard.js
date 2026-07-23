// rent-guard.js
// Include on every stall-management page (dashboard, orders, menu, etc.).
// Two jobs:
//   1. On load, check rental status. If rent is due within the reminder
//      window (or overdue) and unpaid, show a popup with Pay Now / Remind Me.
//   2. If rent is OVERDUE, hard paywall the page: block interaction and force
//      the owner to pay before continuing.
//
// The rental-payment page itself should NOT load this (you're already there
// to pay). Everything else should.

(function () {
  "use strict";

  const RENT_STATUS_URL = "/api/rental/status";
  const RENT_PAY_URL = "/api/rental/pay";

  function money(n) {
    const x = Number(n);
    return Number.isFinite(x) ? `$${x.toFixed(2)}` : "$0.00";
  }

  function fmtDate(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-SG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  async function fetchStatus() {
    const res = await fetch(RENT_STATUS_URL, { credentials: "include" });
    if (res.status === 401 || res.status === 403) return null; // not logged in
    if (!res.ok) return null;
    return res.json();
  }

  function injectStyles() {
    if (document.getElementById("rentGuardStyles")) return;
    const css = `
      .rgOverlay {
        position: fixed; inset: 0; z-index: 9999;
        background: rgba(0,0,0,.55);
        display: flex; align-items: center; justify-content: center;
        padding: 20px;
      }
      .rgModal {
        background: #fffdf7; border-radius: 16px; max-width: 440px; width: 100%;
        box-shadow: 0 20px 60px rgba(0,0,0,.35);
        padding: 24px; font-family: inherit;
        border: 3px solid #e8922e;
      }
      .rgModal.rgLocked { border-color: #b00020; }
      .rgTitle { font-size: 22px; font-weight: 900; margin: 0 0 6px; color: #1c1c1c; }
      .rgSub { font-size: 14px; color: rgba(0,0,0,.7); margin: 0 0 16px; font-weight: 700; }
      .rgAmountBox {
        background: #fff3e0; border-radius: 12px; padding: 16px; text-align: center;
        margin-bottom: 16px;
      }
      .rgModal.rgLocked .rgAmountBox { background: #fde7ea; }
      .rgAmount { font-size: 34px; font-weight: 900; color: #1c1c1c; line-height: 1; }
      .rgDue { font-size: 13px; font-weight: 800; color: rgba(0,0,0,.65); margin-top: 6px; }
      .rgWarn { color: #b00020; font-weight: 900; }
      .rgRow { display: flex; gap: 10px; margin-top: 8px; }
      .rgBtn {
        flex: 1; border: none; border-radius: 10px; padding: 12px 14px;
        font-weight: 900; font-size: 15px; cursor: pointer;
      }
      .rgPay { background: #e8922e; color: #fff; }
      .rgPay:hover { background: #d07f1f; }
      .rgPay:disabled { opacity: .6; cursor: default; }
      .rgLater { background: #eee; color: #333; }
      .rgLater:hover { background: #e2e2e2; }
      .rgMsg { font-size: 13px; font-weight: 800; margin-top: 12px; min-height: 18px; }
      .rgLockNote { font-size: 13px; color: #b00020; font-weight: 800; margin: 0 0 14px; }
    `;
    const style = document.createElement("style");
    style.id = "rentGuardStyles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function buildModal(status, locked) {
    const overlay = document.createElement("div");
    overlay.className = "rgOverlay";
    overlay.id = "rgOverlay";

    const overdueLine = status.isOverdue
      ? `<div class="rgDue rgWarn">Overdue since ${fmtDate(status.dueDate)}</div>`
      : `<div class="rgDue">Due ${fmtDate(status.dueDate)}${
          typeof status.daysUntilDue === "number" && status.daysUntilDue >= 0
            ? ` · in ${status.daysUntilDue} day${status.daysUntilDue === 1 ? "" : "s"}`
            : ""
        }</div>`;

    overlay.innerHTML = `
      <div class="rgModal ${locked ? "rgLocked" : ""}" role="dialog" aria-modal="true">
        <h2 class="rgTitle">${locked ? "Stall access locked" : "Upcoming rental payment"}</h2>
        <p class="rgSub">${status.stallName || "Your stall"} · ${status.monthLabel || ""}</p>
        ${locked ? `<p class="rgLockNote">Your rent is overdue. Stall management is locked until payment is completed.</p>` : ""}
        <div class="rgAmountBox">
          <div class="rgAmount">${money(status.amount)}</div>
          ${overdueLine}
        </div>
        <div class="rgRow">
          <button class="rgBtn rgPay" id="rgPayBtn" type="button">Pay Now</button>
          ${locked ? "" : `<button class="rgBtn rgLater" id="rgLaterBtn" type="button">Remind Me Later</button>`}
        </div>
        <div class="rgMsg" id="rgMsg"></div>
      </div>
    `;
    return overlay;
  }

  function buildToast(status) {
    const el = document.createElement("div");
    el.className = "rgToast";
    el.id = "rgOverlay";
    el.innerHTML = `
      <button class="rgToastX" id="rgLaterBtn" type="button" aria-label="Dismiss">&times;</button>
      <div class="rgToastTitle">Upcoming rental payment</div>
      <div class="rgToastSub">${status.monthLabel || ""}</div>
      <div class="rgToastAmt">${money(status.amount)}</div>
      <div class="rgToastDue">Due ${fmtDate(status.dueDate)}${
        typeof status.daysUntilDue === "number" && status.daysUntilDue >= 0
          ? ` · in ${status.daysUntilDue} day${status.daysUntilDue === 1 ? "" : "s"}`
          : ""
      }</div>
      <button class="rgBtn rgPay" id="rgPayBtn" type="button">Pay Now</button>
      <div class="rgMsg" id="rgMsg"></div>`;
    return el;
  }

  async function doPay(status, locked) {
    const msg = document.getElementById("rgMsg");

    try {
      await window.showPaymentModal({
        method: "paynow",
        amount: status.amount,
        label: "Monthly Bill",
      });
    } catch {
      if (msg) {
        msg.style.color = "rgba(0,0,0,.7)";
        msg.textContent = "Payment cancelled.";
      }
      return;
    }

    const btn = document.getElementById("rgPayBtn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Processing…";
    }
    if (msg) {
      msg.style.color = "rgba(0,0,0,.7)";
      msg.textContent = "Recording payment…";
    }

    try {
      const res = await fetch(RENT_PAY_URL, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "paynow", month: status.month }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Payment failed");

      if (msg) {
        msg.style.color = "#137333";
        msg.textContent = `Paid ${money(data.amount)}. Access restored.`;
      }

      setTimeout(() => {
        document.getElementById("rgOverlay")?.remove();
        document.body.style.overflow = "";
        if (locked) location.reload();
      }, 900);
    } catch (err) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Pay Now";
      }
      if (msg) {
        msg.style.color = "#b00020";
        msg.textContent = `❌ ${err.message}`;
      }
    }
  }

  function showModal(status, mode) {
    injectStyles();
    const existing = document.getElementById("rgOverlay");
    if (existing) existing.remove();

    const locked = mode === "locked";
    const overlay =
      mode === "soft" ? buildToast(status) : buildModal(status, locked);
    document.body.appendChild(overlay);

    document
      .getElementById("rgPayBtn")
      ?.addEventListener("click", () => doPay(status, locked));

    const laterBtn = document.getElementById("rgLaterBtn");
    if (laterBtn) {
      laterBtn.addEventListener("click", () => {
        sessionStorage.setItem("rgDismissed", "1");
        overlay.remove();
        document.body.style.overflow = "";
      });
    }

    if (locked) {
      document.body.style.overflow = "hidden";
    } else if (mode === "urgent") {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          sessionStorage.setItem("rgDismissed", "1");
          overlay.remove();
        }
      });
    }
  }
  if (sessionStorage.getItem("rgDismissed")) return;

  async function init() {
    let status;
    try {
      status = await fetchStatus();
    } catch {
      return; // fail quiet — never block a page because the check errored
    }
    if (!status || !status.hasBill || status.isPaid) return;

    // Overdue → hard paywall (locked, no dismiss).
    // Due today or tomorrow → blocking modal (dismissable).
    // Due 2+ days out → corner toast.
    if (status.isOverdue) {
      showModal(status, "locked");
    } else if (status.showPopup) {
      const urgent =
        typeof status.daysUntilDue === "number" && status.daysUntilDue <= 1;
      showModal(status, urgent ? "urgent" : "soft");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
