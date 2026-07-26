// ============================================================
// stall-closures.js  (for stall-account.html)
//
// Drives the "Closures & Public Holidays" card:
//   - loads upcoming SG public holidays (server-side data.gov.sg call)
//   - lists this stall's existing closures
//   - lets the owner add / remove closures (and quick-add a holiday)
//
// Self-contained (IIFE, own ids) so it won't collide with
// stall-account.js. Matches this page's conventions: same-origin fetch
// with credentials, redirect to signin.html on 401/403, and the page's
// #toast element for feedback.
// ============================================================

(function () {
  const API_BASE = ""; // same origin
  const $ = (id) => document.getElementById(id);

  // Reuse the page's toast if present, else fall back to a no-op.
  function toast(msg) {
    const t = $("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2500);
  }

  function prettyDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString("en-SG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

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

  // Shared fetch wrapper: same auth behaviour as stall-account.js.
  async function api(path, opts = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      ...opts,
    });
    if (res.status === 401 || res.status === 403) {
      location.href = "signin.html";
      throw new Error("unauth");
    }
    return res;
  }

  // --- upcoming holidays --------------------------------------

  async function loadHolidays() {
    const box = $("holidaysList");
    if (!box) return;
    try {
      const res = await api("/api/stall/closures/holidays");
      if (!res.ok) throw new Error("holiday fetch failed");
      const holidays = await res.json();

      if (!holidays.length) {
        box.innerHTML =
          '<div class="acctHint">No upcoming holidays found.</div>';
        return;
      }

      box.innerHTML = holidays
        .map(
          (h) => `
        <div class="acctHourRow">
          <span><b>${esc(prettyDate(h.date))}</b> — ${esc(h.name)}
            <span class="acctHint">(${esc(h.day)})</span></span>
          <button class="btn small primary jsQuickClose"
                  data-date="${esc(h.date)}"
                  data-name="${esc(h.name)}">Mark closed</button>
        </div>`,
        )
        .join("");
    } catch (err) {
      box.innerHTML =
        '<div class="acctHint">Could not load public holidays right now.</div>';
    }
  }

  // --- this stall's closures ----------------------------------

  async function loadClosures() {
    const box = $("closuresList");
    if (!box) return;
    try {
      const res = await api("/api/stall/closures");
      if (!res.ok) throw new Error("closures fetch failed");
      const closures = await res.json();

      if (!closures.length) {
        box.innerHTML = '<div class="acctHint">No closures set.</div>';
        return;
      }

      box.innerHTML = closures
        .map(
          (c) => `
        <div class="acctHourRow">
          <span><b>${esc(prettyDate(c.ClosureDate))}</b>
            ${c.Reason ? "— " + esc(c.Reason) : ""}</span>
          <button class="btn small jsRemoveClosure"
                  data-id="${c.ClosureId}">Remove</button>
        </div>`,
        )
        .join("");
    } catch (err) {
      box.innerHTML =
        '<div class="acctHint">Could not load your closures.</div>';
    }
  }

  // --- create / delete ----------------------------------------

  async function addClosure(dateStr, reason) {
    if (!dateStr) {
      toast("Please pick a date first.");
      return;
    }
    try {
      const res = await api("/api/stall/closures", {
        method: "POST",
        body: JSON.stringify({ closureDate: dateStr, reason: reason || "" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Could not add closure.");
        return;
      }
      toast("Closure added.");
      if ($("closureDateInput")) $("closureDateInput").value = "";
      if ($("closureReasonInput")) $("closureReasonInput").value = "";
      loadClosures();
    } catch (err) {
      toast("Something went wrong. Please try again.");
    }
  }

  async function removeClosure(id) {
    try {
      const res = await api(`/api/stall/closures/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Could not remove closure.");
        return;
      }
      toast("Closure removed.");
      loadClosures();
    } catch (err) {
      toast("Something went wrong. Please try again.");
    }
  }

  // --- wire up -------------------------------------------------

  function init() {
    // Only run on a page that actually has the closures card.
    if (!$("holidaysList") && !$("closuresList")) return;

    // Clear any static "Loading…" placeholders up front so a stray/duplicate
    // one can't linger if the markup was pasted more than once.
    if ($("holidaysList")) $("holidaysList").innerHTML = "";
    if ($("closuresList")) $("closuresList").innerHTML = "";

    const addBtn = $("addClosureBtn");
    if (addBtn) {
      addBtn.addEventListener("click", () =>
        addClosure(
          $("closureDateInput")?.value,
          $("closureReasonInput")?.value,
        ),
      );
    }

    // Collapsible "Upcoming Public Holidays" (mirrors the opening-hours accordion)
    const toggle = $("holidaysToggle");
    const wrap = $("holidaysWrap");
    if (toggle && wrap) {
      const setOpen = (open) => {
        toggle.classList.toggle("open", open);
        wrap.classList.toggle("open", open);
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      };
      setOpen(false); // collapsed by default
      toggle.addEventListener("click", () =>
        setOpen(toggle.getAttribute("aria-expanded") !== "true"),
      );
      toggle.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setOpen(toggle.getAttribute("aria-expanded") !== "true");
        }
      });
    }

    document.addEventListener("click", (e) => {
      const quick = e.target.closest(".jsQuickClose");
      if (quick) {
        addClosure(quick.dataset.date, quick.dataset.name);
        return;
      }
      const rm = e.target.closest(".jsRemoveClosure");
      if (rm) removeClosure(rm.dataset.id);
    });

    loadHolidays();
    loadClosures();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
