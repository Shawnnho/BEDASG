const { sendMail } = require("./mailer");
const path = require("path");

function escapeHtml(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[c],
  );
}

const LOGO_PATH = path.join(__dirname, "..", "public", "images", "logo.png");
const LOGO_CID = "hawkerpointlogo";

const LOGO_ATTACHMENT = {
  filename: "logo.png",
  path: LOGO_PATH,
  cid: LOGO_CID,
};

const BRAND = "#e67e22";
const INK = "#1c1c1c";
const MUTED = "#6b7280";
const BORDER = "#eee";

function money(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}

function wrapEmail({ heading, subheading, bodyHtml }) {
  return `
    <div style="background:#f4f7f6;padding:24px 12px;font-family:'Segoe UI',Arial,sans-serif;color:${INK}">
      <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.06)">

        <div style="background:${BRAND};padding:18px 28px">
          <table cellpadding="0" cellspacing="0" style="border-collapse:collapse">
            <tr>
              <td style="vertical-align:middle;padding-right:10px">
                <img src="cid:${LOGO_CID}" width="32" height="32" alt="HawkerPoint" style="width:32px;height:32px;border-radius:8px;display:block" />
              </td>
              <td style="vertical-align:middle;color:#fff;font-weight:900;font-size:15px;letter-spacing:.5px">
                HAWKERPOINT
              </td>
            </tr>
          </table>
        </div>

        <div style="padding:26px 28px 30px">
          <h2 style="margin:0 0 4px;font-size:20px">${heading}</h2>
          ${subheading ? `<p style="margin:0 0 20px;color:${MUTED};font-size:13.5px">${subheading}</p>` : `<div style="margin-bottom:14px"></div>`}
          ${bodyHtml}
        </div>

        <div style="background:#fafafa;padding:14px 28px;border-top:1px solid ${BORDER};color:${MUTED};font-size:11.5px">
          This is an automated message from HawkerPoint — please don't reply directly to this email.
        </div>
      </div>
    </div>
  `;
}

function orderInfoCard(order) {
  const rows = [
    ["Order No.", order.orderId],
    ["Paid At", order.paidAt],
    ["Stall", escapeHtml(order.stallName)],
    ["Payment", escapeHtml(order.paymentMethod)],
  ];

  const rowsHtml = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:7px 0;color:${MUTED};font-size:13.5px">${label}</td>
          <td style="padding:7px 0;text-align:right;font-weight:700;font-size:13.5px">${value || ""}</td>
        </tr>`,
    )
    .join("");

  return `
    <div style="border:1px solid ${BORDER};border-radius:12px;padding:18px 20px;margin-bottom:22px">
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">
        ${rowsHtml}
        <tr>
          <td style="padding:10px 0 0;border-top:1px solid ${BORDER};font-size:14px">Total Paid</td>
          <td style="padding:10px 0 0;border-top:1px solid ${BORDER};text-align:right;font-weight:900;font-size:16px;color:${BRAND}">
            ${money(order.totalPaid)}
          </td>
        </tr>
      </table>
      ${
        order.pickupStart || order.pickupEnd
          ? `<p style="margin:14px 0 0;color:${MUTED};font-size:13px">
               ⏳ Estimated pickup: <b style="color:${INK}">${order.pickupStart || ""}${order.pickupEnd ? ` – ${order.pickupEnd}` : ""}</b>
             </p>`
          : ""
      }
    </div>
  `;
}

function itemCards(order) {
  return (order.items || [])
    .map((i) => {
      const name = escapeHtml(i.name || "Item");
      const addons = (i.addons || []).map(escapeHtml);
      const note = escapeHtml(i.note);

      return `
        <div style="border:1px solid ${BORDER};border-radius:12px;padding:14px 16px;margin-bottom:12px">
          <div style="font-weight:800;font-size:14.5px;margin-bottom:6px">${name}</div>
          <div style="font-size:13px;color:${MUTED};margin-bottom:2px">${i.qty || 1} × ${name}</div>
          ${addons.length ? `<div style="font-size:12.5px;color:${MUTED};margin-top:4px"><b style="color:${INK}">Add-ons:</b> ${addons.join(", ")}</div>` : ""}
          ${i.note ? `<div style="font-size:12.5px;color:${MUTED};margin-top:2px"><b style="color:${INK}">Note:</b> ${note}</div>` : ""}
        </div>`;
    })
    .join("");
}

// Sent to the customer right after they place an order.
async function sendOrderConfirmation(customerEmail, order) {
  await sendMail({
    to: customerEmail,
    subject: `Order Confirmed — ${order.orderId}`,
    html: wrapEmail({
      heading: "Thank you! Your order has been placed successfully",
      bodyHtml: `
        ${orderInfoCard(order)}
        <h3 style="margin:0 0 12px;font-size:15px">Order Summary</h3>
        ${itemCards(order)}
      `,
    }),
    attachments: [LOGO_ATTACHMENT],
  });
}

// Sent to the stallholder when a new order comes in for their stall.
async function sendNewOrderAlert(stallOwnerEmail, order) {
  await sendMail({
    to: stallOwnerEmail,
    subject: `New Order Received — ${order.orderId}`,
    html: wrapEmail({
      heading: "You've got a new order!",
      subheading: "Log in to your stall dashboard to view and prepare it.",
      bodyHtml: `
        ${orderInfoCard(order)}
        <h3 style="margin:0 0 12px;font-size:15px">Order Summary</h3>
        ${itemCards(order)}
      `,
    }),
    attachments: [LOGO_ATTACHMENT],
  });
}

// Sent to the stallholder when a customer files a complaint against their stall.
async function sendComplaintAlert(stallOwnerEmail, complaint) {
  await sendMail({
    to: stallOwnerEmail,
    subject: `New Complaint Filed — ${escapeHtml(complaint.stallName || "Your Stall")}`,
    html: wrapEmail({
      heading: "A customer has filed a complaint",
      subheading: "Please review this in your stall dashboard.",
      bodyHtml: `
        <div style="border:1px solid ${BORDER};border-radius:12px;padding:18px 20px">
          <p style="margin:0 0 8px;font-size:13.5px"><b>Type:</b> ${escapeHtml(complaint.complaintType || "General")}</p>
          <p style="margin:0;font-size:13.5px;color:${MUTED}">${escapeHtml(complaint.message)}</p>
        </div>
      `,
    }),
    attachments: [LOGO_ATTACHMENT],
  });
}

// Sent to the reporter when the operator dismisses their report 
async function sendReportDismissedAlert(reporterEmail, info) {
  await sendMail({
    to: reporterEmail,
    subject: "Update on your report",
    html: wrapEmail({
      heading: "Your report has been reviewed",
      subheading: "After review, the report was dismissed and the review remains visible.",
      bodyHtml: `
        <div style="border:1px solid ${BORDER};border-radius:12px;padding:18px 20px">
          <p style="margin:0 0 8px;font-size:13.5px"><b>Stall:</b> ${escapeHtml(info.stallName || "")}</p>
          <p style="margin:0;font-size:13.5px;color:${MUTED}">Thank you for helping keep HawkerPoint's reviews trustworthy.</p>
        </div>
      `,
    }),
    attachments: [LOGO_ATTACHMENT],
  });
}

// Sent to the review's author when the operator deletes their review

async function sendReviewDeletedAlert(reviewerEmail, info) {
  await sendMail({
    to: reviewerEmail,
    subject: "Your review has been removed",
    html: wrapEmail({
      heading: "Your review has been removed",
      subheading: "Your review was removed by the stall centre's operator after being reported.",
      bodyHtml: `
        <div style="border:1px solid ${BORDER};border-radius:12px;padding:18px 20px">
          <p style="margin:0 0 8px;font-size:13.5px"><b>Stall:</b> ${escapeHtml(info.stallName || "")}</p>
          <p style="margin:0;font-size:13.5px;color:${MUTED}">If you believe this was a mistake, please contact support.</p>
        </div>
      `,
    }),
    attachments: [LOGO_ATTACHMENT],
  });
}

module.exports = {
  sendOrderConfirmation,
  sendNewOrderAlert,
  sendComplaintAlert,
  sendReportDismissedAlert,
  sendReviewDeletedAlert,
};