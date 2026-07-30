// Shows a simulated payment step. showPaymentModal returns a
// Promise that resolves with { method } on success, or rejects if the user
// cancels. Card details are validated for format only — nothing is transmitted
// or stored. This is a demo gateway stand-in.
//
// Exposes: window.showPaymentModal({ method, amount, label })
//   method: 'paynow' | 'bank'
//   amount: number
//   label:  string (what you're paying for)

(function () {
  "use strict";

  function money(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "$0.00";
    return `$${x.toFixed(2)}`;
  }

  /* ---- saved cards: helpers ---- */

  // The modal doesn't receive a userId (keeps showPaymentModal's signature
  // unchanged for every caller). Fetch it here when the card form opens.
  async function fetchUserId() {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) return null;
      const data = await res.json();
      const u = data.user || data;
      return u.id || u.userId || u.UserId || null;
    } catch {
      return null;
    }
  }

  // Derive the card brand from the first digit (enough for display + the
  // model's allowed list: visa/mastercard/amex/card).
  function brandFromNumber(digits) {
    const d = String(digits || "");
    if (d[0] === "4") return "visa";
    if (d[0] === "5") return "mastercard";
    if (d[0] === "3") return "amex";
    return "card";
  }

  function brandLabel(brand) {
    const b = String(brand || "card").toLowerCase();
    if (b === "visa") return "VISA";
    if (b === "mastercard") return "Mastercard";
    if (b === "amex") return "Amex";
    return "Card";
  }

  async function apiGetCards(uid) {
    const res = await fetch(`/api/savedcards/${encodeURIComponent(uid)}`, {
      credentials: "include",
    });
    if (!res.ok) return [];
    return res.json().catch(() => []);
  }

  async function apiSaveCard(uid, card) {
    return fetch(`/api/savedcards/${encodeURIComponent(uid)}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(card),
    });
  }

  async function apiDeleteCard(uid, savedCardId) {
    return fetch(
      `/api/savedcards/${encodeURIComponent(uid)}/${encodeURIComponent(savedCardId)}`,
      { method: "DELETE", credentials: "include" },
    );
  }

  function luhnValid(num) {
    const digits = num.replace(/\s/g, "");
    if (!/^\d{16}$/.test(digits)) return false;
    let sum = 0,
      alt = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let d = Number(digits[i]);
      if (alt) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
      alt = !alt;
    }
    return sum % 10 === 0;
  }

  function injectStyles() {
    if (document.getElementById("pmStyles")) return;
    const style = document.createElement("style");
    style.id = "pmStyles";
    style.textContent = `
      .pmOverlay {
        position: fixed; inset: 0; z-index: 10000;
        background: rgba(0,0,0,.55);
        display: flex; align-items: center; justify-content: center;
        padding: 20px;
      }
      .pmModal {
        background: #fffdf7; border-radius: 16px; max-width: 420px; width: 100%;
        box-shadow: 0 20px 60px rgba(0,0,0,.35);
        padding: 24px; font-family: inherit;
        border: 3px solid #e8922e;
        max-height: 90vh; overflow-y: auto;
      }
      .pmTitle { font-size: 21px; font-weight: 900; margin: 0 0 4px; color: #1c1c1c; }
      .pmSub { font-size: 13px; font-weight: 700; color: rgba(0,0,0,.65); margin: 0 0 14px; }
      .pmAmount {
        font-size: 32px; font-weight: 900; text-align: center;
        background: #fff3e0; border-radius: 12px; padding: 14px; margin-bottom: 16px;
      }
      .pmField { flex: 1; margin-bottom: 12px; }
      .pmField label {
        display: block; font-size: 12px; font-weight: 800;
        color: rgba(0,0,0,.7); margin-bottom: 4px;
      }
      .pmField input {
        width: 100%; box-sizing: border-box;
        padding: 10px 12px; border-radius: 10px;
        border: 2px solid rgba(0,0,0,.15); background: #fff;
        font-size: 15px; font-weight: 700; font-family: inherit;
      }
      .pmField input:focus { outline: none; border-color: #e8922e; }
      .pmRow { display: flex; gap: 10px; }
      .pmQr { text-align: center; margin-bottom: 14px; }
      .pmQrBox {
        width: 150px; height: 150px; margin: 0 auto 8px;
        background: #fff; border-radius: 10px; padding: 8px;
        border: 2px solid rgba(0,0,0,.12);
        display: flex; align-items: center; justify-content: center;
      }
      .pmQrBox img, .pmQrBox canvas { display: block; }
      .pmErr { color: #b00020; font-size: 13px; font-weight: 800; min-height: 18px; }
      .pmActions { display: flex; gap: 10px; margin-top: 8px; }
      .pmBtn {
        flex: 1; border: none; border-radius: 10px; padding: 12px 14px;
        font-weight: 900; font-size: 15px; cursor: pointer; font-family: inherit;
      }
      .pmPay { background: #e8922e; color: #fff; }
      .pmPay:hover { background: #d07f1f; }
      .pmPay:disabled { opacity: .6; cursor: default; }
      .pmCancel { background: #eee; color: #333; }
      .pmCancel:hover { background: #e2e2e2; }
      .pmCancel:disabled { opacity: .6; cursor: default; }
      .pmMsg { font-size: 13px; font-weight: 800; margin-top: 12px; min-height: 18px; }
      .pmSavedCard {
        display: flex; align-items: center; gap: 10px;
        padding: 10px 12px; margin-bottom: 8px;
        border: 2px solid rgba(0,0,0,.12); border-radius: 10px;
        background: #fff; cursor: pointer; font-weight: 800; font-size: 14px;
      }
      .pmSavedCard.pmSelected { border-color: #e8922e; background: #fff3e0; }
      .pmSavedCard .pmSavedInfo { flex: 1; }
      .pmSavedCard .pmSavedExp { font-size: 12px; font-weight: 700; opacity: .6; }
      .pmSavedDel {
        border: none; background: transparent; cursor: pointer;
        font-weight: 900; color: rgba(0,0,0,.4); font-size: 15px; padding: 2px 6px;
      }
      .pmSavedDel:hover { color: #b00020; }
    `;
    document.head.appendChild(style);
  }

  function showPaymentModal({ method, amount, label }) {
    return new Promise((resolve, reject) => {
      injectStyles();

      const overlay = document.createElement("div");
      overlay.className = "pmOverlay";

      const isCard = method === "bank";
      const isPayNow = method === "paynow";

      const bodyHtml = isCard
        ? `
          <div id="pmSavedWrap" style="display:none; margin-bottom:14px;">
            <div style="font-size:12px; font-weight:800; color:rgba(0,0,0,.7); margin-bottom:6px;">Saved cards</div>
            <div id="pmSavedList"></div>
            <div style="font-size:12px; font-weight:700; opacity:.6; margin-top:6px;">or enter a new card below</div>
          </div>
          <div class="pmField">
            <label>Card Number</label>
            <input id="pmCard" inputmode="numeric" placeholder="4111 1111 1111 1111" maxlength="19" />
          </div>
          <div class="pmRow">
            <div class="pmField">
              <label>Expiry (MM/YY)</label>
              <input id="pmExp" placeholder="12/28" maxlength="5" />
            </div>
            <div class="pmField">
              <label>CVV</label>
              <input id="pmCvv" inputmode="numeric" placeholder="123" maxlength="4" />
            </div>
          </div>
          <label style="display:flex; align-items:center; gap:8px; font-size:13px; font-weight:700; color:rgba(0,0,0,.75); margin-bottom:4px; cursor:pointer;">
            <input type="checkbox" id="pmSaveCard" style="width:auto;" />
            Save this card for next time
          </label>`
        : `
          <div class="pmQr">
            <div class="pmQrBox" aria-hidden="true"></div>
            <div style="font-size:12px; font-weight:800; opacity:.7;">Scan with your banking app</div>
          </div>
          <div class="pmField">
            <label>Payment Reference</label>
            <input id="pmRef" placeholder="e.g. HP-2026-0715" />
          </div>`;

      overlay.innerHTML = `
        <div class="pmModal" role="dialog" aria-modal="true">
          <h3 class="pmTitle">Complete Payment</h3>
          <p class="pmSub">${label} · ${isPayNow ? "PayNow" : "Bank/Card"}</p>
          <div class="pmAmount">${money(amount)}</div>
          ${bodyHtml}
          <div class="pmErr" id="pmErr"></div>
          <div class="pmActions">
            <button class="pmBtn pmCancel" id="pmCancel" type="button">Cancel</button>
            <button class="pmBtn pmPay" id="pmPay" type="button">
              Pay ${money(amount)}
            </button>
          </div>
          <div class="pmMsg" id="pmMsg"></div>
        </div>`;

      document.body.appendChild(overlay);

      // Render a demo QR for PayNow. Falls back to the empty box if the
      // qrcodejs library isn't loaded on this page.
      const qrBox = overlay.querySelector(".pmQrBox");
      if (qrBox && window.QRCode) {
        try {
          new window.QRCode(qrBox, {
            text: `PAYNOW|HAWKERPOINT|${Number(amount).toFixed(2)}|${label}`,
            width: 134,
            height: 134,
          });
        } catch (e) {
          /* leave the placeholder box */
        }
      }

      const err = overlay.querySelector("#pmErr");
      const msg = overlay.querySelector("#pmMsg");
      const payBtn = overlay.querySelector("#pmPay");
      const cancelBtn = overlay.querySelector("#pmCancel");

      // Auto-format card number as groups of 4.
      const cardInput = overlay.querySelector("#pmCard");
      if (cardInput) {
        cardInput.addEventListener("input", () => {
          const digits = cardInput.value.replace(/\D/g, "").slice(0, 16);
          cardInput.value = digits.replace(/(.{4})/g, "$1 ").trim();
        });
      }
      const expInput = overlay.querySelector("#pmExp");
      if (expInput) {
        expInput.addEventListener("input", () => {
          let v = expInput.value.replace(/\D/g, "").slice(0, 4);
          if (v.length >= 3) v = v.slice(0, 2) + "/" + v.slice(2);
          expInput.value = v;
        });
      }

      // ---- saved cards: state + load/pick/delete ----
      let savedUserId = null;
      let selectedSavedCard = null; // { SavedCardId, ... } when a saved card is chosen

      const savedWrap = overlay.querySelector("#pmSavedWrap");
      const savedList = overlay.querySelector("#pmSavedList");
      const saveCheckbox = overlay.querySelector("#pmSaveCard");

      function renderSavedCards(cards) {
        if (!savedWrap || !savedList) return;
        if (!cards.length) {
          savedWrap.style.display = "none";
          return;
        }
        savedWrap.style.display = "";
        savedList.innerHTML = "";
        for (const c of cards) {
          const row = document.createElement("div");
          row.className = "pmSavedCard";
          row.innerHTML = `
            <span class="pmSavedInfo">${brandLabel(c.CardBrand)} •••• ${c.Last4}</span>
            <span class="pmSavedExp">${String(c.ExpMonth).padStart(2, "0")}/${String(c.ExpYear).slice(-2)}</span>
            <button class="pmSavedDel" title="Remove" data-del="${c.SavedCardId}">✕</button>`;

          // pick
          row.addEventListener("click", (e) => {
            if (e.target.closest(".pmSavedDel")) return; // ignore delete clicks
            const already = row.classList.contains("pmSelected");
            savedList
              .querySelectorAll(".pmSavedCard")
              .forEach((r) => r.classList.remove("pmSelected"));
            if (already) {
              selectedSavedCard = null;
            } else {
              row.classList.add("pmSelected");
              selectedSavedCard = c;
              err.textContent = "";
            }
            // dim manual fields while a saved card is chosen
            [cardInput, expInput, overlay.querySelector("#pmCvv")].forEach(
              (el) => {
                if (el) el.disabled = !!selectedSavedCard;
              },
            );
            if (saveCheckbox)
              saveCheckbox.parentElement.style.opacity = selectedSavedCard
                ? ".4"
                : "1";
          });

          // delete
          row
            .querySelector(".pmSavedDel")
            .addEventListener("click", async (e) => {
              e.stopPropagation();
              if (!savedUserId) return;
              await apiDeleteCard(savedUserId, c.SavedCardId);
              if (selectedSavedCard?.SavedCardId === c.SavedCardId)
                selectedSavedCard = null;
              loadSavedCards();
            });

          savedList.appendChild(row);
        }
      }

      async function loadSavedCards() {
        if (!savedUserId) return;
        const cards = await apiGetCards(savedUserId);
        renderSavedCards(cards);
      }

      if (isCard) {
        fetchUserId().then((uid) => {
          savedUserId = uid;
          if (uid) loadSavedCards();
        });
      }

      function cleanup() {
        overlay.remove();
      }

      cancelBtn.addEventListener("click", () => {
        cleanup();
        reject(new Error("cancelled"));
      });
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          cleanup();
          reject(new Error("cancelled"));
        }
      });

      payBtn.addEventListener("click", () => {
        err.textContent = "";

        // Track what we might save after a successful card payment.
        let newCardToSave = null;

        // Format validation (looks legit, not real).
        if (isCard) {
          // A picked saved card skips manual entry + validation entirely.
          if (!selectedSavedCard) {
            const card = overlay.querySelector("#pmCard").value;
            const exp = overlay.querySelector("#pmExp").value;
            const cvv = overlay.querySelector("#pmCvv").value;
            if (!luhnValid(card)) {
              err.textContent = "Enter a valid 16-digit card number.";
              return;
            }
            if (!/^\d{2}\/\d{2}$/.test(exp)) {
              err.textContent = "Expiry must be MM/YY.";
              return;
            }
            const mm = Number(exp.slice(0, 2));
            if (mm < 1 || mm > 12) {
              err.textContent = "Expiry month is invalid.";
              return;
            }
            if (!/^\d{3,4}$/.test(cvv)) {
              err.textContent = "CVV must be 3–4 digits.";
              return;
            }

            // Build the SAFE subset to save — never the full number or CVV.
            if (saveCheckbox && saveCheckbox.checked && savedUserId) {
              const digits = card.replace(/\D/g, "");
              newCardToSave = {
                brand: brandFromNumber(digits),
                last4: digits.slice(-4),
                expMonth: mm,
                expYear: 2000 + Number(exp.slice(3, 5)),
              };
            }
          }
        } else if (isPayNow) {
          const ref = overlay.querySelector("#pmRef").value.trim();
          if (ref.length < 3) {
            err.textContent = "Enter a payment reference.";
            return;
          }
        }

        // Simulate processing.
        payBtn.disabled = true;
        cancelBtn.disabled = true;
        msg.style.color = "rgba(0,0,0,.7)";
        msg.textContent = "Contacting payment gateway…";

        setTimeout(async () => {
          // Persist the card (safe fields only) before resolving. Best-effort:
          // a save failure shouldn't block a successful payment.
          if (newCardToSave) {
            try {
              await apiSaveCard(savedUserId, newCardToSave);
            } catch {
              /* ignore — payment already succeeded */
            }
          }
          msg.style.color = "#137333";
          msg.textContent = "Payment approved ✓";
          setTimeout(() => {
            cleanup();
            resolve({ method });
          }, 600);
        }, 1100);
      });
    });
  }

  window.showPaymentModal = showPaymentModal;
})();
