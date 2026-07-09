// authNav.js — include AFTER authClient.js, before </body>
// Swaps "Log In"/"Sign up" pills for "Log out" when the server confirms
// a valid session (checked via cookie, not localStorage).

(async function () {
  const user = await AuthClient.getCurrentUser();
  if (!user) return; // not logged in — leave the default nav as-is

  document.querySelectorAll('a[href="signin.html"], a[href="signup.html"]').forEach((el) => {
    el.remove();
  });

  document.querySelectorAll(".nav, .navMobile").forEach((nav) => {
    const logoutLink = document.createElement("a");
    logoutLink.href = "#";
    logoutLink.className = nav.className.includes("navMobile") ? "mLink" : "pill";
    logoutLink.textContent = `Log out (${user.name || user.email})`;
    logoutLink.addEventListener("click", async (e) => {
      e.preventDefault();
      await AuthClient.logout();
      window.location.href = "index.html";
    });
    nav.appendChild(logoutLink);
  });
})();
