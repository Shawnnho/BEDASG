const faqModel = require("../models/faqModel");

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

async function getAllFaqs(req, res) {
  try {
    const faqs = await faqModel.getAllFaqs();
    res.json(faqs);
  } catch (err) {
    console.error("getAllFaqs error:", err);
    res.status(500).json({ error: "Failed to retrieve FAQs" });
  }
}

async function getFaqById(req, res) {
  try {
    const id = parseIdOr400(req, res);
    if (id === null) return;
    const faq = await faqModel.getFaqById(id);
    if (!faq) return res.status(404).json({ error: "FAQ not found" });
    res.json(faq);
  } catch (err) {
    console.error("getFaqById error:", err);
    res.status(500).json({ error: "Failed to retrieve FAQ" });
  }
}

async function createFaq(req, res) {
  try {
    const { category, question, answer } = req.body;
    if (!category || !question || !answer) {
      return res
        .status(400)
        .json({ error: "category, question and answer are required" });
    }
    const created = await faqModel.createFaq(req.body);
    res.status(201).json(created);
  } catch (err) {
    console.error("createFaq error:", err);
    res.status(500).json({ error: "Failed to create FAQ" });
  }
}

async function updateFaq(req, res) {
  try {
    const { category, question, answer } = req.body;
    if (!category || !question || !answer) {
      return res
        .status(400)
        .json({ error: "category, question and answer are required" });
    }
    const id = parseIdOr400(req, res);
    if (id === null) return;
    const updated = await faqModel.updateFaq(id, req.body);
    if (!updated) return res.status(404).json({ error: "FAQ not found" });
    res.json(updated);
  } catch (err) {
    console.error("updateFaq error:", err);
    res.status(500).json({ error: "Failed to update FAQ" });
  }
}

async function deleteFaq(req, res) {
  try {
    const id = parseIdOr400(req, res);
    if (id === null) return;
    const deleted = await faqModel.deleteFaq(id);
    if (!deleted) return res.status(404).json({ error: "FAQ not found" });
    res.json({ message: "FAQ deleted", faqId: deleted.faqId });
  } catch (err) {
    console.error("deleteFaq error:", err);
    res.status(500).json({ error: "Failed to delete FAQ" });
  }
}

module.exports = { getAllFaqs, getFaqById, createFaq, updateFaq, deleteFaq };
