// contact.js
const $ = (id) => document.getElementById(id);

const form = $("contactForm");
const success = $("contactSuccess");

function setErr(id, msg) {
  const el = $(id);
  if (el) el.textContent = msg || "";
}

function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = ($("name").value || "").trim();
    const email = ($("email").value || "").trim();
    const role = $("role").value;
    const category = $("category").value;
    const message = ($("message").value || "").trim();

    // reset errors
    setErr("errName", "");
    setErr("errEmail", "");
    setErr("errRole", "");
    setErr("errCategory", "");
    setErr("errMessage", "");
    if (success) success.hidden = true;

    let ok = true;

    if (name.length < 2) {
      setErr("errName", "Please enter your name.");
      ok = false;
    }
    if (!isEmail(email)) {
      setErr("errEmail", "Please enter a valid email.");
      ok = false;
    }
    if (!role) {
      setErr("errRole", "Please select a role.");
      ok = false;
    }
    if (!category) {
      setErr("errCategory", "Please select a category.");
      ok = false;
    }
    if (message.length < 10) {
      setErr("errMessage", "Message should be at least 10 characters.");
      ok = false;
    }

    if (!ok) return;

    // Send to the back-end API
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role, category, message }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // Show server-side field errors if present
        if (data.fields) {
          setErr("errName", data.fields.name);
          setErr("errEmail", data.fields.email);
          setErr("errRole", data.fields.role);
          setErr("errCategory", data.fields.category);
          setErr("errMessage", data.fields.message);
        } else {
          setErr(
            "errMessage",
            data.error || "Something went wrong. Please try again.",
          );
        }
        return;
      }

      form.reset();
      if (success) success.hidden = false;
    } catch (err) {
      console.error("Submit failed:", err);
      setErr("errMessage", "Network error. Please try again later.");
    }
  });
}
