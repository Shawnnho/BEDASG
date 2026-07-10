const complaintModel = require("../models/complaintModel");
const { saveBase64Image } = require("../middlewares/imageStorage");

// POST /api/complaints  (application/json — image sent as a base64 data URL)
async function createComplaint(req, res) {
  try {
    const uid = req.user.userId; // set by verifyToken from the accessToken cookie
    const { stall, stallName, firstName, lastName, email, message, image } = req.body;

    if (!stall || !firstName || !lastName || !email || !message) {
      return res.status(400).json({ error: "Please fill in all fields." });
    }

    let imagePath = null;
    let imageUrl = null;
    if (image) {
      try {
        imageUrl = saveBase64Image({ dataUrl: image, subfolder: "complaints", uid });
        imagePath = imageUrl ? imageUrl.slice(1) : null; 
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }

    const userName = `${firstName.trim()} ${lastName.trim()}`;
    
    const { complaintId } = await complaintModel.createComplaint({
      uid,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      userName,
      email: email.trim(),
      stall,
      stallName: stallName || stall,
      message: message.trim(),
      imagePath,
      imageUrl,
    });

    res.status(201).json({ complaintId });
  } catch (err) {
    console.error("createComplaint error:", err.message);
    res.status(500).json({ error: "Failed to submit complaint." });
  }
}

// GET /api/complaints/mine
async function getMyComplaints(req, res) {
  try {
    const complaints = await complaintModel.getComplaintsByUser(req.user.userId);
    res.json(complaints);
  } catch (err) {
    console.error("getMyComplaints error:", err.message);
    res.status(500).json({ error: "Failed to retrieve complaints." });
  }
}

module.exports = { createComplaint, getMyComplaints };