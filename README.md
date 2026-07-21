# LA Cheshire Homes

Public showcase website for a real estate builder — projects (with image/video galleries) and a blog — with a
Google-authenticated admin CMS for creating and managing content.

## Stack

- Node.js + Express + EJS (server-rendered, no build step)
- SQLite via Node's built-in `node:sqlite` module for data storage (no native build tools required)
- Local disk storage for uploaded images/videos (`public/uploads/`)
- Google OAuth 2.0 for admin login (no signup — access is restricted to an email allowlist)

## Getting started

```sh
npm install
cp .env.example .env
```

Edit `.env`:

- `SESSION_SECRET` — set to any long random string.
- `ADMIN_EMAILS` — comma-separated list of Google account emails allowed to sign in as admin.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from a Google Cloud OAuth 2.0 Client ID (see below). The site runs
  fine without these; the admin login button will show a "not configured" message until they're set.
- `WHATSAPP_NUMBER` — (Optional) Add your WhatsApp number here (e.g. `447123456789`) to display a floating click-to-chat button on all pages.
- `WHATSAPP_MESSAGE` — (Optional) Pre-filled message for the WhatsApp chat.

```sh
npm start        # or: npm run dev (auto-restarts on file changes)
```

Or use one of the startup scripts, which create `.env` from the example (if missing), install dependencies (if
missing), and start the server and an `ngrok` tunnel in one step:

```sh
start.bat     # cmd.exe
.\start.ps1   # PowerShell
```

Visit `http://localhost:5000` (or use the provided ngrok public URL). Admin panel is at `/admin` (redirects to `/admin/login` if not signed in). Note that in development mode, the server listens only on loopback (`127.0.0.1`) to prevent unauthorized local network access.

## Setting up Google OAuth

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials).
2. Create an **OAuth 2.0 Client ID** (Application type: **Web application**).
3. Add an authorized redirect URI: `http://localhost:5000/auth/google/callback` (and your production URL's
   equivalent once deployed, e.g. `https://yourdomain.com/auth/google/callback`).
4. Copy the generated Client ID and Client Secret into `.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
5. Add your Google account email to `ADMIN_EMAILS` in `.env`.

## Project structure

```
server.js            App entry point
db/index.js           SQLite connection + schema
routes/public.js       Public-facing pages (home, projects, blog, about, contact)
routes/admin.js        Admin CMS (protected, CRUD for projects/blog + media upload)
routes/auth.js          Google OAuth login/callback/logout
middleware/auth.js      requireAdmin / attachAdmin session helpers
views/                  EJS templates (layout.ejs is the shared shell)
public/css/styles.css   Responsive site styles
public/uploads/         Uploaded images and videos (gitignored)
data/                   SQLite database file (gitignored)
```

## Content model

- **Projects** — title, location, status (ongoing/upcoming/completed), category (`portfolio` shows as a property
  card with an image carousel; `heritage` shows as a simple list entry — used for the older 2008–2010 track record),
  summary, description, an optional video URL (YouTube/Vimeo — rendered as a "Watch video" button that opens an
  in-page lightbox), cover image, plus an unlimited gallery of images/videos attached per project.
- **Blog posts** — title, excerpt, content, cover image.
- Both support a `published` flag — unpublished items are only visible to admins via the admin panel, never on the
  public site.

## Seeding the original projects

`db/seed.js` populates the database with every project from "LA Homes Cheshire Projects.docx" — 9 portfolio
projects (8 with the real property photos that were embedded in that document, copied into
`public/uploads/images/seed/`) and 12 heritage entries (2008–2010 renovations/conversions, text-only — no photos
were in the source document for these). Run it once against a fresh database:

```sh
node db/seed.js
```

It's safe to re-run — projects are matched by title and skipped if they already exist. To add real photos to
"Longcroft Lane Farmhouse" (the one portfolio project with no source photo) or to attach a video link to any
project, use the admin edit form after signing in.

## Email (contact form)

The contact form at `/contact` sends enquiries via Gmail using OAuth2 (nodemailer).
To set up the sending account — obtaining the client ID/secret and refresh token —
follow [`docs/EMAIL_SETUP.md`](docs/EMAIL_SETUP.md).

## Notes / next steps

- Blog/description content is stored as plain text with newlines converted to `<br>`. Swap in a rich text editor
  (e.g. TipTap, Quill) in the admin forms if formatted content is needed.
- For production, put this behind a reverse proxy (nginx/Caddy) with HTTPS, and update `SITE_URL` plus the Google
  OAuth redirect URI accordingly.
