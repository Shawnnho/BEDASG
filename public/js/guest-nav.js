/*************************************************
 * guest-nav.js — Hawker Point
 * Runs on every page. If the visitor is NOT logged in (guest mode),
 * it strips the nav down to only: Orders, Cart, Login, Sign up.
 * Logged-in users keep the full navbar untouched.
 *************************************************/

async function isLoggedIn() {
  try {
    const res = await fetch("/api/auth/me");
    return res.ok;
  } catch {
    return false;
  }
}

// The four links a guest is allowed to see, in order. Cart keeps its badge
// span so the existing cart-count code still updates it.
function guestDesktopHtml() {
  return `
    <a class="pill" href="orders.html">Orders</a>
    <a class="pill cartPill" href="cart.html">
      Cart <span id="cartCount" class="cartBadge isZero">0</span>
    </a>
    <a class="pill" href="signin.html">Login</a>
  <a class="pill account" href="signup.html" style="background:#df8f3b;color:#fff">Sign up for free today</a>
  `;
}

function guestMobileHtml() {
  return `
    <a class="mLink" href="orders.html">Orders</a>
    <a class="mLink" href="cart.html">
      Cart <span id="cartCountMobile" class="cartBadge isZero">0</span>
    </a>
    <a class="mLink" href="signin.html">Login</a>
   <a class="mLink" href="signup.html" style="background:#df8f3b;color:#fff">Sign up for free today</a>
  `;
}

function applyGuestNav() {
  const desktop = document.querySelector(".nav");
  const mobile = document.querySelector(".navMobile");

  if (desktop) desktop.innerHTML = guestDesktopHtml();
  if (mobile) mobile.innerHTML = guestMobileHtml();

  // Mark the active tab so styling still highlights the current page.
  const current = (
    window.location.pathname.split("/").pop() || ""
  ).toLowerCase();
  document.querySelectorAll(".nav a.pill, .navMobile a.mLink").forEach((a) => {
    const href = (a.getAttribute("href") || "").split("?")[0].toLowerCase();
    a.classList.toggle("active", href === current);
  });
}

(async () => {
  const loggedIn = await isLoggedIn();
  if (!loggedIn) applyGuestNav();
})();
