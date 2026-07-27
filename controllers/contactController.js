const contactModel = require("../models/contactModel");

const VALID_ROLES = ["customer", "storeholder", "nea_officer"];
const VALID_CATEGORIES = ["general", "orders", "hygiene", "reviews", "account"];

function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || "");
}

// Parses a route :id param, or sends a 400 and returns null if it isn't a
// number — otherwise a non-numeric id reaches the DB driver and comes back
// as a generic 500 instead of a client error.
function parseIdOr400(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return null;
  }
  return id;
}

async function getAllMessages(req, res) {
  try {
    const messages = await contactModel.getAllMessages();
    res.json(messages);
  } catch (err) {
    console.error("getAllMessages error:", err);
    res.status(500).json({ error: "Failed to retrieve messages" });
  }
}

async function getMessageById(req, res) {
  try {
    const id = parseIdOr400(req, res);
    if (id === null) return;
    const msg = await contactModel.getMessageById(id);
    if (!msg) return res.status(404).json({ error: "Message not found" });
    res.json(msg);
  } catch (err) {
    console.error("getMessageById error:", err);
    res.status(500).json({ error: "Failed to retrieve message" });
  }
}

async function createMessage(req, res) {
  try {
    const name = (req.body.name || "").trim();
    const email = (req.body.email || "").trim();
    const { role, category } = req.body;
    const message = (req.body.message || "").trim();

    // Server-side validation (mirrors the front-end checks)
    const errors = {};
    if (name.length < 2) errors.name = "Please enter your name.";
    if (!isEmail(email)) errors.email = "Please enter a valid email.";
    if (!VALID_ROLES.includes(role))
      errors.role = "Please select a valid role.";
    if (!VALID_CATEGORIES.includes(category))
      errors.category = "Please select a valid category.";
    if (message.length < 10)
      errors.message = "Message should be at least 10 characters.";

    if (Object.keys(errors).length > 0) {
      return res
        .status(400)
        .json({ error: "Validation failed", fields: errors });
    }

    const created = await contactModel.createMessage({
      name,
      email,
      role,
      category,
      message,
    });
    res.status(201).json(created);
  } catch (err) {
    console.error("createMessage error:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
}

async function updateStatus(req, res) {
  try {
    const { status } = req.body;
    if (!["new", "read", "resolved"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const id = parseIdOr400(req, res);
    if (id === null) return;
    const updated = await contactModel.updateStatus(id, status);
    if (!updated) return res.status(404).json({ error: "Message not found" });
    res.json(updated);
  } catch (err) {
    console.error("updateStatus error:", err);
    res.status(500).json({ error: "Failed to update message" });
  }
}

async function deleteMessage(req, res) {
  try {
    const id = parseIdOr400(req, res);
    if (id === null) return;
    const deleted = await contactModel.deleteMessage(id);
    if (!deleted) return res.status(404).json({ error: "Message not found" });
    res.json({ message: "Message deleted", messageId: deleted.messageId });
  } catch (err) {
    console.error("deleteMessage error:", err);
    res.status(500).json({ error: "Failed to delete message" });
  }
}

module.exports = {
  getAllMessages,
  getMessageById,
  createMessage,
  updateStatus,
  deleteMessage,
};
