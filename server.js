require("dotenv").config();

const express = require("express");
const path = require("node:path");
const session = require("express-session");
const expressLayouts = require("express-ejs-layouts");

const { attachAdmin } = require("./middleware/auth");
const { embedUrlFor } = require("./helpers/media");
const publicRoutes = require("./routes/public");
const adminRoutes = require("./routes/admin");
const authRoutes = require("./routes/auth");

const app = express();
const PORT = Number(process.env.PORT || 5000);
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const HOST = process.env.HOST || (IS_PRODUCTION ? "0.0.0.0" : "127.0.0.1");

// Behind a reverse proxy (nginx, Caddy, a PaaS load balancer), the proxy talks
// to Node over plain HTTP and forwards the real scheme/host in X-Forwarded-*
// headers. Trusting the proxy makes req.protocol / req.secure / req.get("host")
// reflect the public HTTPS URL, so the OAuth callback and secure cookie work
// without hardcoding the domain. Configure explicitly with TRUST_PROXY when the
// hop count differs (e.g. TRUST_PROXY=2), else default to one hop in production.
app.set("trust proxy", resolveTrustProxy());

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
app.set("layout", "layout");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      // "auto" = secure only over HTTPS. Combined with trust proxy above, the
      // cookie is marked Secure on a real HTTPS domain but stays usable on
      // http://localhost during development — no manual toggling on URL change.
      secure: "auto",
      maxAge: 7 * 24 * 60 * 60 * 1000
    }
  })
);

app.use((req, res, next) => {
  res.locals.siteName = process.env.SITE_NAME || "LA Cheshire Homes";
  res.locals.embedUrlFor = embedUrlFor;
  const whatsappNumber = (process.env.WHATSAPP_NUMBER || "").replace(/[^\d]/g, "");
  res.locals.whatsappNumber = whatsappNumber;
  res.locals.whatsappUrl = whatsappNumber
    ? `https://wa.me/${whatsappNumber}${process.env.WHATSAPP_MESSAGE ? `?text=${encodeURIComponent(process.env.WHATSAPP_MESSAGE)}` : ""}`
    : "";
  next();
});
app.use(attachAdmin);

app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/", publicRoutes);

app.use((req, res) => {
  res.status(404).render("404", { title: "Page not found" });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).send(err.message || "Something went wrong.");
});

function resolveTrustProxy() {
  const raw = process.env.TRUST_PROXY;
  if (raw === undefined || raw === "") return IS_PRODUCTION ? 1 : false;
  if (raw === "true") return true;
  if (raw === "false") return false;
  const asNumber = Number(raw);
  return Number.isFinite(asNumber) ? asNumber : raw; // number of hops, or a subnet/IP string
}

app.listen(PORT, HOST, () => {
  const publicHost = HOST === "127.0.0.1" ? "localhost" : HOST;
  console.log(`LA Cheshire Homes running at http://${publicHost}:${PORT}`);
});
