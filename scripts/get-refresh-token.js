/**
 * One-time helper: generates a Google OAuth2 REFRESH TOKEN for sending email
 * and saves it to the project .env as GOOGLE_EMAIL_REFRESH_TOKEN.
 *
 * Usage:  node scripts/get-refresh-token.js
 *   1. The script prints a Google consent URL and waits.
 *   2. Open the URL in a browser, sign in with the Gmail account the site
 *      should send from, and approve.
 *   3. Google redirects back to this script, which exchanges the code and
 *      writes the refresh token into .env, then exits.
 *
 * Reads GOOGLE_EMAIL_CLIENT_ID / GOOGLE_EMAIL_CLIENT_SECRET from the
 * environment (or .env). If your OAuth client is a "Web application" type,
 * http://localhost:8765/oauth2callback must be in its Authorized redirect
 * URIs. "Desktop app" clients allow localhost automatically.
 */
require("dotenv").config({ path: require("node:path").join(__dirname, "..", ".env") });

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const CLIENT_ID = process.env.GOOGLE_EMAIL_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_EMAIL_CLIENT_SECRET || "";
const PORT = 8765;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;
// Full mail scope so the token works with nodemailer SMTP OAuth2 as well as the Gmail API.
const SCOPE = process.env.GOOGLE_EMAIL_SCOPE || "https://mail.google.com/";
const ENV_PATH = path.join(__dirname, "..", ".env");
const ENV_KEY = "GOOGLE_EMAIL_REFRESH_TOKEN";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("GOOGLE_EMAIL_CLIENT_ID / GOOGLE_EMAIL_CLIENT_SECRET are not set in the environment or .env.");
  process.exit(1);
}

const state = crypto.randomBytes(16).toString("hex");
const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", CLIENT_ID);
authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", SCOPE);
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");
authUrl.searchParams.set("state", state);

function saveToEnv(refreshToken) {
  let content = "";
  try {
    content = fs.readFileSync(ENV_PATH, "utf8");
  } catch {
    content = "";
  }
  const line = `${ENV_KEY}=${refreshToken}`;
  if (new RegExp(`^${ENV_KEY}=`, "m").test(content)) {
    content = content.replace(new RegExp(`^${ENV_KEY}=.*$`, "m"), line);
  } else {
    if (content.length && !content.endsWith("\n")) content += "\n";
    content += `\n# OAuth2 refresh token for sending email (generated ${new Date().toISOString().slice(0, 10)})\n${line}\n`;
  }
  fs.writeFileSync(ENV_PATH, content);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname !== "/oauth2callback") {
    res.writeHead(404);
    return res.end("Not found");
  }

  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error || !code || returnedState !== state) {
    res.writeHead(400, { "content-type": "text/html" });
    res.end(`<h2>Authorisation failed</h2><p>${error || "Missing code or state mismatch."} You can close this tab and re-run the script.</p>`);
    console.error("Authorisation failed:", error || "missing code / state mismatch");
    process.exit(1);
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code"
      })
    });
    const tokens = await tokenResponse.json();

    if (!tokenResponse.ok || !tokens.refresh_token) {
      throw new Error(tokens.error_description || tokens.error || "No refresh_token in response.");
    }

    saveToEnv(tokens.refresh_token);

    res.writeHead(200, { "content-type": "text/html" });
    res.end("<h2>Done ✔</h2><p>The refresh token has been saved to the project .env file. You can close this tab.</p>");
    console.log(`SUCCESS: ${ENV_KEY} saved to .env (scope: ${SCOPE}).`);
    setTimeout(() => process.exit(0), 300);
  } catch (err) {
    res.writeHead(500, { "content-type": "text/html" });
    res.end(`<h2>Token exchange failed</h2><p>${err.message}</p>`);
    console.error("Token exchange failed:", err.message);
    setTimeout(() => process.exit(1), 300);
  }
});

server.listen(PORT, () => {
  console.log("Waiting for Google consent. Open this URL in your browser:\n");
  console.log(authUrl.toString());
  console.log("\n(If your OAuth client is a Web application type, make sure");
  console.log(`${REDIRECT_URI} is listed under its Authorized redirect URIs.)`);
});

// Give up after 10 minutes so the script doesn't hang forever.
setTimeout(() => {
  console.error("Timed out after 10 minutes without a callback. Re-run the script to try again.");
  process.exit(1);
}, 10 * 60 * 1000);
