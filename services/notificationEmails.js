const { sendMail } = require("./mailer");

function money(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}

// order shape expected here, matching the receipt page:
// {
//   orderId, paidAt, stallName, paymentMethod, totalPaid,
//   pickupStart, pickupEnd,
//   items: [{ name, qty, addons: [], note }]
// }
function orderInfoRows(order) {
  return `
    <tr>
      <td style="padding:6px 0;color:#555">Order No.</td>
      <td style="padding:6px 0;text-align:right"><b>${order.orderId || ""}</b></td>
    </tr>
    <tr>
      <td style="padding:6px 0;color:#555">Paid At</td>
      <td style="padding:6px 0;text-align:right"><b>${order.paidAt || ""}</b></td>
    </tr>
    <tr>
      <td style="padding:6px 0;color:#555">Stall</td>
      <td style="padding:6px 0;text-align:right"><b>${order.stallName || ""}</b></td>
    </tr>
    <tr>
      <td style="padding:6px 0;color:#555">Payment</td>
      <td style="padding:6px 0;text-align:right"><b>${order.paymentMethod || ""}</b></td>
    </tr>
    <tr>
      <td style="padding:6px 0;color:#555;border-top:1px solid #eee">Total Paid</td>
      <td style="padding:6px 0;text-align:right;border-top:1px solid #eee"><b>${money(order.totalPaid)}</b></td>
    </tr>
  `;
}

function pickupLine(order) {
  if (!order.pickupStart && !order.pickupEnd) return "";
  return `<p style="color:#555">⏳ Estimated pickup time: <b>${order.pickupStart || ""}${order.pickupEnd ? ` – ${order.pickupEnd}` : ""}</b></p>`;
}

function itemCards(order) {
  return (order.items || [])
    .map(
      (i) => `
        <div style="border:1px solid #eee;border-radius:10px;padding:14px;margin-bottom:10px">
          <h3 style="margin:0 0 8px">${i.name}</h3>
          <p style="margin:2px 0"><b>Order No:</b> ${order.orderId || ""}</p>
          <p style="margin:2px 0"><b>Stall:</b> ${order.stallName || ""}</p>
          <p style="margin:2px 0"><b>${i.qty || 1} x ${i.name}</b></p>
          ${i.addons && i.addons.length ? `<p style="margin:2px 0"><b>Add-ons:</b> ${i.addons.join(", ")}</p>` : ""}
          ${i.note ? `<p style="margin:2px 0"><b>Note:</b> ${i.note}</p>` : ""}
        </div>`,
    )
    .join("");
}

// Sent to the customer right after they place an order.
async function sendOrderConfirmation(customerEmail, order) {
  await sendMail({
    to: customerEmail,
    subject: `Order Confirmed — ${order.orderId}`,
    html: `
      <h2>Thank you! Your order has been placed successfully</h2>
      <div style="border:1px solid #eee;border-radius:12px;padding:16px;margin-bottom:20px">
        <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">
          ${orderInfoRows(order)}
        </table>
        ${pickupLine(order)}
      </div>
      <h3>Order Summary</h3>
      ${itemCards(order)}
    `,
  });
}

// Sent to the stallholder when a new order comes in for their stall.
async function sendNewOrderAlert(stallOwnerEmail, order) {
  await sendMail({
    to: stallOwnerEmail,
    subject: `New Order Received — ${order.orderId}`,
    html: `
      <h2>You've got a new order!</h2>
      <div style="border:1px solid #eee;border-radius:12px;padding:16px;margin-bottom:20px">
        <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">
          ${orderInfoRows(order)}
        </table>
      </div>
      <h3>Order Summary</h3>
      ${itemCards(order)}
      <p>Log in to your stall dashboard to view and prepare it.</p>
    `,
  });
}

// Sent to the stallholder when a customer files a complaint against their stall.
async function sendComplaintAlert(stallOwnerEmail, complaint) {
  await sendMail({
    to: stallOwnerEmail,
    subject: `New Complaint Filed — ${complaint.stallName || "Your Stall"}`,
    html: `
      <h2>A customer has filed a complaint</h2>
      <p><b>Type:</b> ${complaint.complaintType || "General"}</p>
      <p><b>Message:</b> ${complaint.message || ""}</p>
      <p>Please review this in your stall dashboard.</p>
    `,
  });
}

module.exports = { sendOrderConfirmation, sendNewOrderAlert, sendComplaintAlert };