function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || "");
}

// SG mobile numbers start with 8 or 9, 8 digits total — matches the
// validation your team's original signup.js used.
function isPhone(v) {
  return /^[89]\d{7}$/.test(v || "");
}

function validateRegister(req, res, next) {
  const name = (req.body.name || "").trim();
  const email = (req.body.email || "").trim();
  const phone = (req.body.phone || "").trim();
  const password = req.body.password || "";
  const confirmPassword = req.body.confirmPassword || "";
  const role = req.body.role || "customer";

  const errors = {};
  if (name.length < 2) errors.name = "Please enter your full name.";
  if (!isEmail(email)) errors.email = "Please enter a valid email.";
  if (!isPhone(phone)) errors.phone = "Enter a valid SG phone (8 digits).";
  if (password.length < 6)
    errors.password = "Password must be at least 6 characters.";
  if (confirmPassword !== password)
    errors.confirmPassword = "Passwords do not match.";
  if (!["customer", "storeholder"].includes(role))
    errors.role = "Please select a valid role.";

  // Storeholder-specific required fields
  if (role === "storeholder") {
    const centreId = (req.body.stallCentreId || "").trim();
    const stallName = (req.body.stallName || "").trim();
    const stallCuisine = (req.body.stallCuisine || "").trim();

    if (!centreId) errors.stallCentreId = "Please select a hawker centre.";
    if (!stallName) errors.stallName = "Please enter your stall name.";
    if (!stallCuisine) errors.stallCuisine = "Please enter a cuisine.";

    req.body.stallCentreId = centreId;
    req.body.stallName = stallName;
    req.body.stallCuisine = stallCuisine;
  }

  if (Object.keys(errors).length > 0) {
    return res
      .status(400)
      .json({ error: "Validation failed", fields: errors });
  }

  req.body.name = name;
  req.body.email = email.toLowerCase();
  req.body.phone = phone;
  req.body.role = role;
  next();
}

function validateLogin(req, res, next) {
  const email = (req.body.email || "").trim();
  const password = req.body.password || "";

  const errors = {};
  if (!isEmail(email)) errors.email = "Please enter a valid email.";
  if (!password) errors.password = "Please enter your password.";

  if (Object.keys(errors).length > 0) {
    return res
      .status(400)
      .json({ error: "Validation failed", fields: errors });
  }

  req.body.email = email.toLowerCase();
  next();
}

module.exports = { validateRegister, validateLogin };
