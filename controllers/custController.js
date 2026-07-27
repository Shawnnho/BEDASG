const custModel = require("../models/custModel");

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

// PUT /api/cust/:id -> update name, email, and phone
// Expects body: { Name: "...", Email: "...", Phone: "..." }
async function updateProfile(req, res) {
  try {
    const userId = req.params.id;
    if (!userId) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const { Name, Email, Phone } = req.body;

    if (!Name || !Email || !Phone) {
      return res
        .status(400)
        .json({ error: "Name, Email, and Phone are all required" });
    }

    const updated = await custModel.updateProfile(userId, { Name, Email, Phone });

    if (!updated) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const customer = {
      id: updated.UserId,
      name: updated.Name,
      email: updated.Email,
      phone: updated.Phone,
    };

    res.json(customer);
  } catch (error) {
    console.error("Error updating customer:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = { getCustomer, updateProfile };