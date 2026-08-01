const complaintModel = require("../models/complaintModel");
const { validateBase64Image } = require("../middlewares/imageStorage");
const stallOwnerLookupModel = require("../models/stallOwnerLookupModel");
const { sendComplaintAlert } = require("../services/notificationEmails");

// POST /api/complaints  
// Creates a Complaint to a stall that the user has selected
async function createComplaint(req, res) {
  // #swagger.tags = ['Complaints']
  try {
    const uid = req.user.userId; 
    const { stall, stallName, firstName, lastName, email, message, image } = req.body;

    let imageUrl = null;
    if (image) {
      try {
        imageUrl = validateBase64Image(image);
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
      imagePath: null,
      imageUrl,
    });

    stallOwnerLookupModel
      .getStallOwnerEmail(stall)
      .then((ownerEmail) => {
        if (ownerEmail) {
          sendComplaintAlert(ownerEmail, {
            stallName: stallName || stall,
            message: message.trim(),
          });
        }
      })
      .catch((err) => console.error("Complaint alert email failed:", err.message));

    res.status(201).json({ complaintId });
  } catch (err) {
    console.error("createComplaint error:", err.message);
    res.status(500).json({ error: "Failed to submit complaint." });
  }
}

// GET /api/complaints/mine
// Retrieves the user's complaints
async function getMyComplaints(req, res) {
  // #swagger.tags = ['Complaints']
  try {
    const complaints = await complaintModel.getComplaintsByUser(req.user.userId);
    res.json(complaints);
  } catch (err) {
    console.error("getMyComplaints error:", err.message);
    res.status(500).json({ error: "Failed to retrieve complaints." });
  }
}

// PUT /api/complaints/:complaintId
// Updates a user's complaint that the user has selected
async function updateComplaint(req, res) {
  // #swagger.tags = ['Complaints']
  try {
    const { complaintId } = req.params;
    const { message } = req.body;

    await complaintModel.updateComplaint(complaintId, { message: message.trim() });
    res.json({ success: true });
  } catch (err) {
    console.error("updateComplaint error:", err.message);
    res.status(500).json({ error: "Failed to update complaint." });
  }
}

// DELETE /api/complaints/:complaintId
// Deletes a complaint that the user has
async function deleteComplaint(req, res) {
  // #swagger.tags = ['Complaints']
  try {
    const { complaintId } = req.params;
    await complaintModel.deleteComplaint(complaintId);
    res.status(204).send();
  } catch (err) {
    console.error("deleteComplaint error:", err.message);
    res.status(500).json({ error: "Failed to delete complaint." });
  }
}

module.exports = {
  createComplaint,
  getMyComplaints,
  updateComplaint,
  deleteComplaint,
};