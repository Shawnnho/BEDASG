// ============================================================
// stall-promotions.js  (for stall-promotions.html)
//
// Stallholder promotion management: list this stall's promotions,
// create new ones, edit existing ones (form flips to edit mode), and
// delete. Talks to the gated /api/promotions endpoints.
//
// Matches the stall pages' conventions: same-origin fetch with
// credentials, redirect to signin.html on 401/403, #toast for feedback.
// ============================================================

(function () {
  const API_BASE = ""; // same origin
  const $ = (id) => document.getElementById(id);

  function toast(msg) {
    const t = $("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2500);
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

  function prettyDate(iso) {
    if (!iso) return "No expiry";
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString("en-SG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  // Describe the discount in words for the list.
  function discountText(p) {
    if (p.PromoType === "percentage") {
      let s = `${p.DiscountValue}% off`;
      if (p.MaxDiscount) s += ` (max $${Number(p.MaxDiscount).toFixed(2)})`;
      return s;
    }
    return `$${Number(p.DiscountValue).toFixed(2)} off`;
  }

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

  // Convert a chosen file to a base64 data URL (matches stall-menu.js).
  // Rejects files over ~1.5MB to keep request sizes reasonable.
  function fileToBase64(file) {
    if (!file) return Promise.resolve(null);
    if (file.size > 1.5 * 1024 * 1024) {
      return Promise.reject(new Error("Image too large (max ~1.5MB)"));
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Failed to read image"));
      reader.readAsDataURL(file);
    });
  }

  // Show/hide the preview + remove button for a given image value.
  function showImage(dataUrl) {
    const preview = $("imagePreview");
    const removeBtn = $("removeImageBtn");
    if (dataUrl) {
      preview.src = dataUrl;
      preview.style.display = "block";
      removeBtn.style.display = "inline-flex";
    } else {
      preview.src = "";
      preview.style.display = "none";
      removeBtn.style.display = "none";
    }
  }

  // --- read / render ------------------------------------------

  async function loadPromotions() {
    const box = $("promoList");
    if (!box) return;
    try {
      const res = await api("/api/promotions/mine");
      if (!res.ok) throw new Error("fetch failed");
      const promos = await res.json();

      if (!promos.length) {
        box.innerHTML =
          '<div class="acctHint">No promotions yet. Create one above.</div>';
        return;
      }

      box.innerHTML = promos
        .map((p) => {
          const popular = p.IsPopular
            ? '<span class="promoBadge">Popular</span>'
            : "";
          return `
        <div class="promoRow">
          <div class="promoRowMain">
            <div class="promoRowTitle">
              ${esc(p.PromoTitle)} ${popular}
            </div>
            <div class="promoRowMeta">
              Code <b>${esc(p.PromoCode)}</b> · ${esc(discountText(p))}
              · min spend $${Number(p.MinSpend).toFixed(2)}
            </div>
            <div class="promoRowMeta">
              ${p.RedemptionsLeft} left · expires ${esc(prettyDate(p.ExpiresAt))}
            </div>
          </div>
          <div class="promoRowActions">
            <button class="btn small jsEditPromo"
                    data-id="${esc(p.PromotionId)}">Edit</button>
            <button class="btn small jsDeletePromo"
                    data-id="${esc(p.PromotionId)}">Delete</button>
          </div>
        </div>`;
        })
        .join("");
    } catch (err) {
      box.innerHTML =
        '<div class="acctHint">Could not load your promotions.</div>';
    }
  }

  // --- form helpers -------------------------------------------

  // Gather the form into the payload the API expects.
  function readForm() {
    const num = (id) => {
      const v = $(id).value.trim();
      return v === "" ? null : Number(v);
    };
    return {
      promoTitle: $("promoTitle").value.trim(),
      promoCode: $("promoCode").value.trim(),
      desc: $("promoDesc").value.trim(),
      promoType: $("promoType").value,
      discountValue: num("discountValue"),
      minSpend: num("minSpend") ?? 0,
      maxDiscount: num("maxDiscount"),
      redemptionsLeft: num("redemptionsLeft"),
      expiresAt: $("expiresAt").value || null,
      isPopular: $("isPopular").checked,
      claimOnce: $("claimOnce").checked,
      requiredKeyword: $("requiredKeyword").value.trim(),
      imageUrl: $("imageUrl").value.trim(),
    };
  }

  function clearForm() {
    $("promoId").value = "";
    [
      "promoTitle",
      "promoCode",
      "promoDesc",
      "discountValue",
      "minSpend",
      "maxDiscount",
      "redemptionsLeft",
      "expiresAt",
      "requiredKeyword",
      "imageUrl",
    ].forEach((id) => ($(id).value = ""));
    if ($("imageFile")) $("imageFile").value = "";
    showImage(null);
    $("promoType").value = "percentage";
    $("isPopular").checked = false;
    $("claimOnce").checked = false;

    // Reset to create mode
    $("formTitle").textContent = "Create a Promotion";
    $("saveBtnLabel").textContent = "Create Promotion";
    $("cancelEditBtn").style.display = "none";
  }

  // Fill the form from an existing promo for editing.
  function fillForm(p) {
    $("promoId").value = p.PromotionId;
    $("promoTitle").value = p.PromoTitle || "";
    $("promoCode").value = p.PromoCode || "";
    $("promoDesc").value = p.Desc || "";
    $("promoType").value = p.PromoType || "percentage";
    $("discountValue").value = p.DiscountValue ?? "";
    $("minSpend").value = p.MinSpend ?? "";
    $("maxDiscount").value = p.MaxDiscount ?? "";
    $("redemptionsLeft").value = p.RedemptionsLeft ?? "";
    $("expiresAt").value = p.ExpiresAt || "";
    $("isPopular").checked = !!p.IsPopular;
    $("claimOnce").checked = !!p.ClaimOnce;
    $("requiredKeyword").value = p.RequiredKeyword || "";
    $("imageUrl").value = p.ImageUrl || "";
    showImage(p.ImageUrl || null);
    if ($("imageFile")) $("imageFile").value = "";

    // Switch to edit mode
    $("formTitle").textContent = "Edit Promotion";
    $("saveBtnLabel").textContent = "Save Changes";
    $("cancelEditBtn").style.display = "inline-flex";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // --- create / update / delete -------------------------------

  async function savePromotion() {
    const payload = readForm();
    const id = $("promoId").value;
    const isEdit = !!id;

    try {
      const res = await api(
        isEdit ? `/api/promotions/${id}` : "/api/promotions",
        {
          method: isEdit ? "PUT" : "POST",
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Could not save promotion.");
        return;
      }
      toast(isEdit ? "Promotion updated." : "Promotion created.");
      clearForm();
      loadPromotions();
    } catch (err) {
      toast("Something went wrong. Please try again.");
    }
  }

  async function deletePromotion(id) {
    if (!confirm("Delete this promotion? This cannot be undone.")) return;
    try {
      const res = await api(`/api/promotions/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Could not delete promotion.");
        return;
      }
      toast("Promotion deleted.");
      // If we were editing the one we just deleted, reset the form.
      if ($("promoId").value === id) clearForm();
      loadPromotions();
    } catch (err) {
      toast("Something went wrong. Please try again.");
    }
  }

  // Fetch a single promo (from the current list) to populate edit form.
  async function startEdit(id) {
    try {
      const res = await api("/api/promotions/mine");
      if (!res.ok) throw new Error("fetch failed");
      const promos = await res.json();
      const promo = promos.find((p) => p.PromotionId === id);
      if (!promo) {
        toast("Promotion not found.");
        loadPromotions();
        return;
      }
      fillForm(promo);
    } catch (err) {
      toast("Could not load that promotion.");
    }
  }

  // Fill the topbar stall name / owner name, matching the other stall pages.
  // Reuses the stall menu endpoint, which returns { stallName, ownerName }.
  async function loadHeader() {
    try {
      const res = await api("/api/stall/menu");
      if (!res.ok) return;
      const data = await res.json();
      if ($("stallName")) $("stallName").textContent = data.stallName || "—";
      if ($("ownerName"))
        $("ownerName").textContent = data.ownerName || "Owner";
    } catch (err) {
      /* header is cosmetic; ignore failures */
    }
  }

  // --- wire up -------------------------------------------------

  function init() {
    if (!$("promoList")) return;

    $("savePromoBtn")?.addEventListener("click", savePromotion);
    $("cancelEditBtn")?.addEventListener("click", clearForm);

    // Image picker: convert to base64, preview it, store in hidden #imageUrl.
    $("imageFile")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await fileToBase64(file);
        $("imageUrl").value = dataUrl || "";
        showImage(dataUrl);
      } catch (err) {
        toast(err.message || "Could not read that image.");
        e.target.value = "";
      }
    });

    // Remove image: clear the picker, preview and stored value.
    $("removeImageBtn")?.addEventListener("click", () => {
      $("imageFile").value = "";
      $("imageUrl").value = "";
      showImage(null);
    });

    document.addEventListener("click", (e) => {
      const edit = e.target.closest(".jsEditPromo");
      if (edit) {
        startEdit(edit.dataset.id);
        return;
      }
      const del = e.target.closest(".jsDeletePromo");
      if (del) deletePromotion(del.dataset.id);
    });

    loadHeader();
    loadPromotions();

    // Logout: clear the session cookie server-side, then return to sign-in.
    $("logoutBtn")?.addEventListener("click", async () => {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
        });
      } catch (err) {
        /* even if the call fails, still send them to sign-in */
      }
      location.href = "signin.html";
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
