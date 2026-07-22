const express = require("express");
const db = require("../db");
const { sendContactEmail, emailConfigured } = require("../helpers/mailer");

const router = express.Router();

function attachImages(projects) {
  if (!projects.length) return projects;
  const ids = projects.map(p => p.id);
  const placeholders = ids.map(() => "?").join(",");
  const media = db
    .prepare(
      `SELECT * FROM project_media WHERE project_id IN (${placeholders}) AND type = 'image'
       ORDER BY sort_order ASC, id ASC`
    )
    .all(...ids);

  const byProject = new Map();
  media.forEach(item => {
    if (!byProject.has(item.project_id)) byProject.set(item.project_id, []);
    byProject.get(item.project_id).push(item);
  });

  return projects.map(project => ({
    ...project,
    images: byProject.get(project.id) || (project.cover_image ? [{ file_path: project.cover_image }] : [])
  }));
}

// Projects featured in the homepage hero carousel, shown in this order.
// Curated rather than "latest" so the hero always leads with the strongest
// photography; unpublished or renamed slugs are simply skipped.
const HERO_SLUGS = [
  "fairfield-road-development",
  "tennyson-close-bungalow",
  "edinburgh-road-bungalow",
  "cheadle-wood"
];

function heroProjects() {
  const placeholders = HERO_SLUGS.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT * FROM projects WHERE published = 1 AND slug IN (${placeholders})`)
    .all(...HERO_SLUGS);
  const bySlug = new Map(rows.map(row => [row.slug, row]));
  return attachImages(HERO_SLUGS.map(slug => bySlug.get(slug)).filter(Boolean));
}

router.get("/", (req, res) => {
  const latestProjects = attachImages(
    db
      .prepare("SELECT * FROM projects WHERE published = 1 AND category = 'portfolio' ORDER BY created_at DESC LIMIT 3")
      .all()
  );
  const latestPosts = db
    .prepare("SELECT * FROM blog_posts WHERE published = 1 ORDER BY created_at DESC LIMIT 3")
    .all();
  const projectCount = db.prepare("SELECT COUNT(*) AS n FROM projects WHERE published = 1").get().n;
  res.render("index", { title: "Home", latestProjects, heroProjects: heroProjects(), latestPosts, projectCount });
});

router.get("/projects", (req, res) => {
  const status = ["ongoing", "completed", "upcoming"].includes(req.query.status) ? req.query.status : null;
  const baseQuery = "SELECT * FROM projects WHERE published = 1 AND category = 'portfolio'";
  const projects = attachImages(
    status
      ? db.prepare(`${baseQuery} AND status = ? ORDER BY created_at DESC`).all(status)
      : db.prepare(`${baseQuery} ORDER BY created_at DESC`).all()
  );
  const heritage = db
    .prepare("SELECT * FROM projects WHERE published = 1 AND category = 'heritage' ORDER BY created_at ASC")
    .all();
  res.render("projects", { title: "Projects", projects, heritage, activeStatus: status });
});

router.get("/projects/:slug", (req, res) => {
  const project = db.prepare("SELECT * FROM projects WHERE slug = ? AND published = 1").get(req.params.slug);
  if (!project) return res.status(404).render("404", { title: "Not found" });
  const media = db
    .prepare("SELECT * FROM project_media WHERE project_id = ? ORDER BY sort_order ASC, id ASC")
    .all(project.id);
  const images = media.filter(item => item.type === "image");
  res.render("project-detail", {
    title: project.title,
    project,
    images: images.length ? images : project.cover_image ? [{ file_path: project.cover_image }] : [],
    videos: media.filter(item => item.type === "video")
  });
});

router.get("/blog", (req, res) => {
  const posts = db.prepare("SELECT * FROM blog_posts WHERE published = 1 ORDER BY created_at DESC").all();
  res.render("blog", { title: "Blog", posts });
});

router.get("/blog/:slug", (req, res) => {
  const post = db.prepare("SELECT * FROM blog_posts WHERE slug = ? AND published = 1").get(req.params.slug);
  if (!post) return res.status(404).render("404", { title: "Not found" });
  res.render("blog-post", { title: post.title, post });
});

router.get("/about", (req, res) => {
  res.render("about", { title: "About us" });
});

router.get("/contact", (req, res) => {
  res.render("contact", {
    title: "Contact us",
    sent: req.query.sent === "1",
    error: null,
    form: {}
  });
});

router.post("/contact", async (req, res) => {
  const { name, email, phone, message, company } = req.body;

  // Honeypot: real users never fill the hidden "company" field.
  if (company) return res.redirect("/contact?sent=1");

  const form = { name, email, phone, message };
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
  if (!name?.trim() || !validEmail || !message?.trim()) {
    return res.status(400).render("contact", {
      title: "Contact us",
      sent: false,
      error: "Please fill in your name, a valid email address, and a message.",
      form
    });
  }

  if (!emailConfigured()) {
    return res.status(500).render("contact", {
      title: "Contact us",
      sent: false,
      error: "Email sending is not configured on the server yet. Please call or email us directly.",
      form
    });
  }

  try {
    await sendContactEmail({
      name: name.trim().slice(0, 120),
      email: email.trim().slice(0, 200),
      phone: (phone || "").trim().slice(0, 40),
      message: message.trim().slice(0, 5000)
    });
    res.redirect("/contact?sent=1");
  } catch (err) {
    console.error("[contact] send failed:", err.message);
    res.status(502).render("contact", {
      title: "Contact us",
      sent: false,
      error: "Sorry — we couldn't send your message just now. Please try again, or email us directly.",
      form
    });
  }
});

module.exports = router;
