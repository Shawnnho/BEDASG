const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendMail({ to, subject, html }) {
  if (!to) {
    console.warn("sendMail skipped — no recipient email provided.");
    return;
  }

  try {
    await transporter.sendMail({
      from: `"HawkerPoint" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error("sendMail failed:", err.message);
  }
}

module.exports = { sendMail };