const bcrypt = require("bcrypt");
const custModel = require("../models/custModel");

const SALT_ROUNDS = 10; // matches bcrypt's common default - adjust to match your signup code's cost factor

// GET /api/cust/:id -> single customer profile
async function getCustomer(req, res) {
  try {
    const userId = req.params.id;
    if (!userId) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const rows = await custModel.getCustomer(userId);

    if (!rows.length) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const r = rows[0];
    const customer = {
      id: r.UserId,
      name: r.Name,
      email: r.Email,
      phone: r.Phone,
      role: r.UserRole,
      pfp: r.AvatarUrl || "",
      date: r.CreatedAt
    };

    res.json(customer);
  } catch (error) {
    console.error("Error fetching customer:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// PUT /api/cust/:id -> update name, email, phone, and (optionally) avatar
// application/json body: { Name, Email, Phone, AvatarUrl }
// AvatarUrl (if present) is a base64 data URL from the client (e.g.
// "data:image/png;base64,..."), same pattern as the complaints page's
// fileToBase64() - no multer/multipart involved.
async function updateProfile(req, res) {
  try {
    const userId = req.params.id;
    if (!userId) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const { Name, Email, Phone, AvatarUrl } = req.body;

    if (!Name || !Email || !Phone) {
      return res
        .status(400)
        .json({ error: "Name, Email, and Phone are all required" });
    }

    // AvatarUrl is optional - if omitted/null, updateProfile() leaves the
    // existing avatar untouched (via COALESCE in the SQL).
    const updated = await custModel.updateProfile(userId, {
      Name,
      Email,
      Phone,
      AvatarUrl: AvatarUrl || null,
    });

    if (!updated) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const customer = {
      id: updated.UserId,
      name: updated.Name,
      email: updated.Email,
      phone: updated.Phone,
      pfp: updated.AvatarUrl || "",
    };

    res.json(customer);
  } catch (error) {
    console.error("Error updating customer:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// PATCH /api/cust/:id/password -> verify current password, then set new one
// Expects body: { currentPassword: "...", newPassword: "..." }
async function changePassword(req, res) {
  try {
    const userId = req.params.id;
    if (!userId) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: "currentPassword and newPassword are both required" });
    }

    if (newPassword.length < 8) {
      return res
        .status(400)
        .json({ error: "newPassword must be at least 8 characters" });
    }

    const existingHash = await custModel.getPasswordHash(userId);

    if (!existingHash) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, existingHash);

    if (!isMatch) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const updated = await custModel.changePassword(userId, newHash);

    if (!updated) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = { getCustomer, updateProfile, changePassword };