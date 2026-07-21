const express = require("express");
const crypto = require("node:crypto");
const db = require("../db");

const router = express.Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.google_client_id || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || process.env.google_client_secret || "";
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map(email => email.trim().toLowerCase())
  .filter(Boolean);

function siteUrl(req) {
  // Prefer an explicit SITE_URL (most robust in production). Otherwise derive it
  // from the request. With "trust proxy" enabled in server.js, req.protocol
  // honors X-Forwarded-Proto; we also prefer X-Forwarded-Host so the derived URL
  // is correct even when the proxy rewrites the Host header to the backend.
  const host = req.get("x-forwarded-host") || req.get("host") || "";
  const requestedHost = String(host).split(",")[0].trim().toLowerCase();

  const configuredSiteUrl = (process.env.SITE_URL || "").trim();
  if (configuredSiteUrl) {
    try {
      const configuredHost = new URL(configuredSiteUrl).hostname.toLowerCase();
      const configuredIsLocal = configuredHost === "localhost" || configuredHost === "127.0.0.1";
      const requestIsLocal =
        requestedHost.startsWith("localhost") ||
        requestedHost.startsWith("127.0.0.1") ||
        requestedHost === "";

      // If SITE_URL is still localhost but traffic arrives on a public host
      // (e.g. ngrok), prefer the request host to keep OAuth callback and
      // session domain consistent.
      if (!(configuredIsLocal && !requestIsLocal)) {
        return configuredSiteUrl.replace(/\/+$/, "");
      }
    } catch {
      return configuredSiteUrl.replace(/\/+$/, "");
    }
  }

  return `${req.protocol}://${host}`.replace(/\/+$/, "");
}

router.get("/google", (req, res) => {
  if (!GOOGLE_CLIENT_ID) {
    return res.status(500).render("admin/login", {
      title: "Admin login",
      error: "Google sign-in is not configured yet. Set google_client_id and google_client_secret in the environment."
    });
  }

  const state = crypto.randomBytes(24).toString("hex");
  req.session.oauthState = state;

  const redirectUri = `${siteUrl(req)}/auth/google/callback`;
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("access_type", "online");
  authUrl.searchParams.set("prompt", "select_account");

  res.redirect(authUrl.toString());
});

router.get("/google/callback", async (req, res) => {
  const { code, state, error } = req.query;

  if (error || !code || !state || state !== req.session.oauthState) {
    return res.redirect("/admin/login?error=auth_failed");
  }
  delete req.session.oauthState;

  try {
    const redirectUri = `${siteUrl(req)}/auth/google/callback`;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || tokenData.error || "Token exchange failed.");
    }

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { authorization: `Bearer ${tokenData.access_token}` }
    });
    const profile = await profileResponse.json();
    if (!profileResponse.ok || !profile.email) {
      throw new Error("Failed to load Google profile.");
    }

    const email = String(profile.email).toLowerCase();
    if (ADMIN_EMAILS.length && !ADMIN_EMAILS.includes(email)) {
      return res.redirect("/admin/login?error=not_authorized");
    }

    db.prepare(
      `INSERT INTO admins (email, name, picture) VALUES (?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET name = excluded.name, picture = excluded.picture`
    ).run(email, profile.name || email, profile.picture || "");

    req.session.admin = { email, name: profile.name || email, picture: profile.picture || "" };
    const returnTo = req.session.returnTo || "/admin";
    delete req.session.returnTo;
    res.redirect(returnTo);
  } catch (err) {
    console.error("[auth] Google sign-in failed:", err.message);
    res.redirect("/admin/login?error=auth_failed");
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

module.exports = router;
