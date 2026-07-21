const nodemailer = require("nodemailer");

function emailConfigured() {
  return Boolean(
    process.env.GOOGLE_EMAIL_CLIENT_ID &&
    process.env.GOOGLE_EMAIL_CLIENT_SECRET &&
    process.env.GOOGLE_EMAIL_REFRESH_TOKEN &&
    process.env.GOOGLE_EMAIL_USER
  );
}

let transporter = null;

function getTransporter() {
  if (!emailConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: process.env.GOOGLE_EMAIL_USER,
        clientId: process.env.GOOGLE_EMAIL_CLIENT_ID,
        clientSecret: process.env.GOOGLE_EMAIL_CLIENT_SECRET,
        refreshToken: process.env.GOOGLE_EMAIL_REFRESH_TOKEN
      }
    });
  }
  return transporter;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, ch => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]
  ));
}

async function sendContactEmail({ name, email, phone, message }) {
  const transport = getTransporter();
  if (!transport) {
    throw new Error("Email is not configured. Set GOOGLE_EMAIL_* variables.");
  }

  const to = process.env.CONTACT_RECIPIENT || process.env.GOOGLE_EMAIL_USER;
  const siteName = process.env.SITE_NAME || "LA Cheshire Homes";

  await transport.sendMail({
    from: `"${siteName} website" <${process.env.GOOGLE_EMAIL_USER}>`,
    to,
    replyTo: email,
    subject: `New enquiry from ${name} — ${siteName}`,
    text:
      `New website enquiry\n\n` +
      `Name: ${name}\n` +
      `Email: ${email}\n` +
      `Phone: ${phone || "not provided"}\n\n` +
      `Message:\n${message}\n`,
    html:
      `<h2 style="margin:0 0 12px">New website enquiry</h2>` +
      `<table cellpadding="6" style="border-collapse:collapse">` +
      `<tr><td><b>Name</b></td><td>${escapeHtml(name)}</td></tr>` +
      `<tr><td><b>Email</b></td><td>${escapeHtml(email)}</td></tr>` +
      `<tr><td><b>Phone</b></td><td>${escapeHtml(phone) || "not provided"}</td></tr>` +
      `</table>` +
      `<p style="white-space:pre-wrap;border-left:3px solid #B08D46;padding-left:12px;margin-top:14px">${escapeHtml(message)}</p>`
  });
}

module.exports = { sendContactEmail, emailConfigured, getTransporter };
