const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const search = $("#faqSearch");
const chips = $$(".chip");
const faqList = $("#faqList");

let currentCat = "all";
let items = [];

function normalize(s) {
  return (s || "").toLowerCase().trim();
}

function escapeHtml(s) {
  return (s || "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

// Fetch FAQs from the back-end API and render them
async function loadFaqs() {
  try {
    const res = await fetch("/api/faqs");
    if (!res.ok) throw new Error("Failed to load FAQs");
    const faqs = await res.json();
    renderFaqs(faqs);
  } catch (err) {
    console.error(err);
    faqList.innerHTML =
      '<div class="about-card"><p>Sorry, we could not load help topics right now. Please try again later.</p></div>';
  }
}

function renderFaqs(faqs) {
  faqList.innerHTML = faqs
    .map(
      (f) => `
      <div class="about-card faqItem" data-cat="${escapeHtml(f.category)}"
           data-keywords="${escapeHtml(f.keywords)}">
        <button class="faqQ" type="button" aria-expanded="false">
          <span>${escapeHtml(f.question)}</span>
          <span class="faqIcon" aria-hidden="true">+</span>
        </button>
        <div class="faqA" hidden>${escapeHtml(f.answer)}</div>
      </div>`,
    )
    .join("");

  items = $$(".faqItem");
  bindAccordion();
  applyFilters();
}

function applyFilters() {
  const q = normalize(search.value);

  items.forEach((card) => {
    const cat = card.getAttribute("data-cat") || "";
    const keywords = normalize(card.getAttribute("data-keywords"));
    const text = normalize(card.innerText);

    const matchCat = currentCat === "all" ? true : cat === currentCat;
    const matchSearch =
      q.length === 0 ? true : keywords.includes(q) || text.includes(q);

    card.style.display = matchCat && matchSearch ? "" : "none";
  });
}

function bindAccordion() {
  $$(".faqQ").forEach((qBtn) => {
    qBtn.addEventListener("click", () => {
      const card = qBtn.closest(".faqItem");
      const ans = card.querySelector(".faqA");
      const isOpen = qBtn.getAttribute("aria-expanded") === "true";

      qBtn.setAttribute("aria-expanded", String(!isOpen));
      ans.hidden = isOpen;

      const icon = qBtn.querySelector(".faqIcon");
      if (icon) icon.textContent = isOpen ? "+" : "–";
    });
  });
}

// Category chip filtering
chips.forEach((btn) => {
  btn.addEventListener("click", () => {
    chips.forEach((c) => c.classList.remove("isActive"));
    btn.classList.add("isActive");
    currentCat = btn.getAttribute("data-cat") || "all";
    applyFilters();
  });
});

// Search filtering
if (search) search.addEventListener("input", applyFilters);

// Initial load
loadFaqs();
    