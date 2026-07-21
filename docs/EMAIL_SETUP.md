# Setting up a Gmail sender for the contact form

This guide walks through configuring the website to send contact-form enquiries
from a Gmail (or Google Workspace) account using OAuth2. You'll end up with three
credentials:

| Credential | Purpose |
|---|---|
| `GOOGLE_EMAIL_CLIENT_ID` | Identifies the OAuth app to Google |
| `GOOGLE_EMAIL_CLIENT_SECRET` | Secret paired with the client ID |
| `GOOGLE_EMAIL_REFRESH_TOKEN` | Long-lived token that lets the server send mail as the account, without storing the password |

> **Why OAuth2 and not a password?** Google no longer allows plain password
> login for apps, and "App Passwords" require 2-Step Verification and can be
> revoked centrally. OAuth2 with a refresh token is the supported, secure path:
> the server never sees the account password, and you can revoke access at any
> time from the Google account's security settings.

---

## Prerequisites

- A Google account you want enquiries to be **sent from** (e.g. `info@yourdomain.com`).
- Access to the [Google Cloud Console](https://console.cloud.google.com/).
- Node.js installed and the project dependencies present (`npm install`).

---

## Step 1 — Create a Google Cloud project

1. Go to <https://console.cloud.google.com/>.
2. In the top bar, click the project dropdown → **New Project**.
3. Give it a name (e.g. `LA Homes Website`) and click **Create**.
4. Make sure the new project is selected in the top bar before continuing.

---

## Step 2 — Enable the Gmail API

1. Go to **APIs & Services → Library**
   (<https://console.cloud.google.com/apis/library>).
2. Search for **Gmail API**, open it, and click **Enable**.

---

## Step 3 — Configure the OAuth consent screen

1. Go to **APIs & Services → OAuth consent screen**
   (<https://console.cloud.google.com/apis/credentials/consent>).
2. **User type:**
   - Choose **External** unless the account is part of a Google Workspace org
     and you only need internal users (then **Internal** is simpler — no test
     users, no verification).
3. Fill in the required fields:
   - **App name** (e.g. `LA Homes Cheshire`)
   - **User support email**
   - **Developer contact email**
4. **Scopes:** you can leave this empty here — the scope is requested by the
   token script directly. (Optionally add `https://mail.google.com/`.)
5. **Test users (External + "Testing" status only):**
   - Add the exact Gmail address you'll send from as a **test user**.
   - ⚠️ If you skip this, the token step will fail with
     "access_denied / app not verified".
6. Save. You do **not** need to publish the app or go through Google
   verification for a server that only sends its own mail — leaving it in
   **Testing** is fine (see [Token expiry](#token-expiry-testing-mode) below).

---

## Step 4 — Create the OAuth Client ID (get the client secret)

1. Go to **APIs & Services → Credentials**
   (<https://console.cloud.google.com/apis/credentials>).
2. Click **Create Credentials → OAuth client ID**.
3. **Application type:** choose one:
   - **Desktop app** — simplest. Localhost redirect is allowed automatically,
     nothing extra to register. **Recommended** for this server-side use.
   - **Web application** — if you pick this, you must add the redirect URI the
     token script listens on (see Step 5) under **Authorized redirect URIs**,
     e.g. `http://localhost:8765/oauth2callback`.
4. Name it (e.g. `LA Homes mailer`) and click **Create**.
5. A dialog shows your **Client ID** and **Client secret**. Copy both.
   - You can re-open them any time from the Credentials list.

### Store the client ID and secret

Set them as environment variables (recommended) **or** put them in the project
`.env` file.

**Windows (PowerShell) — persist as user environment variables:**

```powershell
setx GOOGLE_EMAIL_CLIENT_ID    "your-client-id.apps.googleusercontent.com"
setx GOOGLE_EMAIL_CLIENT_SECRET "your-client-secret"
```

> `setx` writes to the user environment; **open a new terminal** afterwards for
> the values to be visible.

**Or add to `.env` in the project root:**

```
GOOGLE_EMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_EMAIL_CLIENT_SECRET=your-client-secret
```

The app reads either location — OS environment variables take priority, then
`.env`.

---

## Step 5 — Generate the refresh token

The project includes a helper script that runs the one-time consent flow and
writes the refresh token into `.env` automatically.

1. From a terminal **that can see the client ID/secret** (a new terminal after
   `setx`, or one where `.env` already has them), run:

   ```powershell
   cd C:\Users\masoo\Documents\Claude_Code\LACheshireHomes
   node scripts\get-refresh-token.js
   ```

2. The script prints a **Google consent URL** and waits. Copy it into a browser.
3. Sign in with the **exact account you want to send from** and approve.
   - If you see *"Google hasn't verified this app"*, click **Advanced →
     Continue** (expected for an unpublished app).
   - If you get **`redirect_uri_mismatch`**, your OAuth client is a *Web
     application* type — add `http://localhost:8765/oauth2callback` to its
     Authorized redirect URIs (Step 4.3) and retry.
4. Google redirects back to the local script, which exchanges the code and
   saves `GOOGLE_EMAIL_REFRESH_TOKEN` into `.env`. The browser shows
   **"Done ✔"** and the terminal prints `SUCCESS`.

> The script requests the `https://mail.google.com/` scope with
> `access_type=offline` and `prompt=consent`, which is what forces Google to
> return a **refresh** token (not just a short-lived access token).

---

## Step 6 — Tell the app which address is the sender / recipient

Add these to `.env`:

```
# The account that authorized the refresh token above (the "From" address)
GOOGLE_EMAIL_USER=info@yourdomain.com

# Where contact-form enquiries should be delivered (can be the same or different)
CONTACT_RECIPIENT=enquiries@yourdomain.com
```

- `GOOGLE_EMAIL_USER` **must** match the account you signed in with in Step 5,
  or Gmail will reject the send.
- To find the authorized address programmatically, you can run:

  ```powershell
  node -e "require('dotenv').config(); fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:process.env.GOOGLE_EMAIL_CLIENT_ID,client_secret:process.env.GOOGLE_EMAIL_CLIENT_SECRET,refresh_token:process.env.GOOGLE_EMAIL_REFRESH_TOKEN,grant_type:'refresh_token'})}).then(r=>r.json()).then(t=>fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile',{headers:{authorization:'Bearer '+t.access_token}})).then(r=>r.json()).then(p=>console.log(p.emailAddress))"
  ```

---

## Step 7 — Verify it works

Confirm Gmail accepts the credentials **without sending anything**:

```powershell
node -e "require('dotenv').config(); const {getTransporter}=require('./helpers/mailer'); getTransporter().verify().then(()=>console.log('SMTP AUTH OK')).catch(e=>console.log('FAILED: '+e.message))"
```

You should see `SMTP AUTH OK`. Then:

1. Start the site (`npm start` or `start.bat`).
2. Go to <http://localhost:5000/contact>, submit a test enquiry.
3. Check the `CONTACT_RECIPIENT` inbox (check **Spam** the first time).

---

## Final `.env` block (summary)

```
GOOGLE_EMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_EMAIL_CLIENT_SECRET=your-client-secret
GOOGLE_EMAIL_REFRESH_TOKEN=1//0g...            # generated by the script
GOOGLE_EMAIL_USER=info@yourdomain.com
CONTACT_RECIPIENT=enquiries@yourdomain.com
```

> `.env` is gitignored — never commit these values. If a secret is ever exposed,
> rotate it: delete the OAuth client (or reset its secret) in the Cloud Console
> and regenerate the token.

---

## Switching to a different sender account later

1. Repeat **Step 5** signed in as the new account — the script overwrites
   `GOOGLE_EMAIL_REFRESH_TOKEN` in `.env`.
2. Update `GOOGLE_EMAIL_USER` (and optionally `CONTACT_RECIPIENT`) to match.
3. Re-run the verify command from Step 7 and restart the site.

The client ID/secret can stay the same across sender accounts (they belong to
the Cloud project, not the mailbox) — only the refresh token and
`GOOGLE_EMAIL_USER` change.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `redirect_uri_mismatch` on the consent page | OAuth client is *Web application* type but the redirect URI isn't registered. Add `http://localhost:8765/oauth2callback`, or switch to a *Desktop app* client. |
| `access_denied` / "app not verified" and you can't continue | Add your Gmail address as a **test user** on the OAuth consent screen (Step 3.5), or set consent to **Internal** for Workspace. |
| Script finished but no `refresh_token` | You'd authorized this client before, so Google skipped consent. The script uses `prompt=consent` to avoid this; if it still happens, revoke the app at <https://myaccount.google.com/permissions> and re-run. |
| `SMTP AUTH FAILED: invalid_grant` | The refresh token was revoked or expired — regenerate it (Step 5). See token expiry below. |
| Emails send but land in Spam | Normal for a brand-new sender. For production, set up SPF/DKIM on your domain (Workspace does this for you) or use a dedicated transactional provider. |

### Token expiry (Testing mode)

If the OAuth consent screen is left in **Testing** (not Published), Google
expires refresh tokens after **7 days**. Options:

- **Publish the app** (OAuth consent screen → **Publish app**). For a project
  that only sends its own mail with the `mail.google.com` scope, this moves it
  out of the 7-day window. Google may show a verification banner, but sending
  continues to work; full verification is only needed for public multi-user
  apps.
- Or, if you keep it in Testing, plan to re-run the token script (Step 5)
  periodically.

For a small business site sending its own enquiries, **Internal** (Workspace)
or **Published External** are the low-maintenance choices.
