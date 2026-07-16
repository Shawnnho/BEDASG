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

// Edit your own complaint 
async function updateComplaint(req, res) {
  try {
    const { complaintId } = req.params;
    const uid = req.user.userId;
 
    const complaint = await complaintModel.getComplaintById(complaintId);
    if (!complaint) return res.status(404).json({ error: "Complaint not found." });
    if (complaint.Uid !== uid) {
      return res.status(403).json({ error: "You can only edit your own complaint." });
    }
 
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message cannot be empty." });
    }
 
    await complaintModel.updateComplaint(complaintId, { message: message.trim() });
    res.json({ success: true });
  } catch (err) {
    console.error("updateComplaint error:", err.message);
    res.status(500).json({ error: "Failed to update complaint." });
  }
}
 
// Delete your own complaint 
async function deleteComplaint(req, res) {
  try {
    const { complaintId } = req.params;
    const uid = req.user.userId;
 
    const complaint = await complaintModel.getComplaintById(complaintId);
    if (!complaint) return res.status(404).json({ error: "Complaint not found." });
    if (complaint.Uid !== uid) {
      return res.status(403).json({ error: "You can only delete your own complaint." });
    }
 
    await complaintModel.deleteComplaint(complaintId);
    res.status(204).send();
  } catch (err) {
    console.error("deleteComplaint error:", err.message);
    res.status(500).json({ error: "Failed to delete complaint." });
  }
}
module.exports = { 
  createComplaint, getMyComplaints, updateComplaint, deleteComplaint,
};