const express = require("express");
const path = require("node:path");
const fs = require("node:fs");
const multer = require("multer");
const slugify = require("slugify");
const db = require("../db");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

function uploadDirFor(mimetype) {
  return IMAGE_TYPES.has(mimetype) ? "images" : "videos";
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = path.join(__dirname, "..", "public", "uploads", uploadDirFor(file.mimetype));
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, unique);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (IMAGE_TYPES.has(file.mimetype) || VIDEO_TYPES.has(file.mimetype)) return cb(null, true);
    cb(new Error("Unsupported file type. Upload JPEG/PNG/WEBP/GIF images or MP4/WEBM/MOV videos."));
  }
});

function publicPathFor(mimetype, filename) {
  return `/uploads/${uploadDirFor(mimetype)}/${filename}`;
}

function uniqueSlug(table, base, ignoreId) {
  const root = slugify(base, { lower: true, strict: true }) || "item";
  let candidate = root;
  let suffix = 2;
  for (;;) {
    const row = ignoreId
      ? db.prepare(`SELECT id FROM ${table} WHERE slug = ? AND id != ?`).get(candidate, ignoreId)
      : db.prepare(`SELECT id FROM ${table} WHERE slug = ?`).get(candidate);
    if (!row) return candidate;
    candidate = `${root}-${suffix++}`;
  }
}

// --- Login screens (not protected) ---
router.get("/login", (req, res) => {
  if (req.session?.admin) return res.redirect("/admin");
  const errorMap = {
    auth_failed: "Sign-in failed. Please try again.",
    not_authorized: "That Google account is not authorized for admin access."
  };
  res.render("admin/login", { title: "Admin login", error: errorMap[req.query.error] || null });
});

// --- Everything below requires an authenticated admin ---
router.use(requireAdmin);

router.get("/", (req, res) => {
  const projectCount = db.prepare("SELECT COUNT(*) AS n FROM projects").get().n;
  const postCount = db.prepare("SELECT COUNT(*) AS n FROM blog_posts").get().n;
  res.render("admin/dashboard", { title: "Admin dashboard", projectCount, postCount });
});

// --- Projects ---
router.get("/projects", (req, res) => {
  const projects = db.prepare("SELECT * FROM projects ORDER BY created_at DESC").all();
  res.render("admin/projects", { title: "Manage projects", projects });
});

router.get("/projects/new", (req, res) => {
  res.render("admin/project-form", { title: "New project", project: null, media: [] });
});

router.post("/projects", upload.single("cover_image"), (req, res) => {
  const { title, location, summary, description, status, category, video_url, published } = req.body;
  if (!title?.trim()) return res.status(400).send("Title is required.");

  const slug = uniqueSlug("projects", title);
  const coverPath = req.file ? publicPathFor(req.file.mimetype, req.file.filename) : null;

  db.prepare(
    `INSERT INTO projects (slug, title, location, summary, description, status, category, cover_image, video_url, published)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    slug, title.trim(), location || "", summary || "", description || "",
    status || "ongoing", category === "heritage" ? "heritage" : "portfolio",
    coverPath, (video_url || "").trim() || null, published ? 1 : 0
  );

  res.redirect("/admin/projects");
});

router.get("/projects/:id/edit", (req, res) => {
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
  if (!project) return res.status(404).send("Project not found.");
  const media = db
    .prepare("SELECT * FROM project_media WHERE project_id = ? ORDER BY sort_order ASC, id ASC")
    .all(project.id);
  res.render("admin/project-form", { title: "Edit project", project, media });
});

router.post("/projects/:id", upload.single("cover_image"), (req, res) => {
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
  if (!project) return res.status(404).send("Project not found.");

  const { title, location, summary, description, status, category, video_url, published } = req.body;
  if (!title?.trim()) return res.status(400).send("Title is required.");

  const slug = title.trim() !== project.title ? uniqueSlug("projects", title, project.id) : project.slug;
  const coverPath = req.file ? publicPathFor(req.file.mimetype, req.file.filename) : project.cover_image;

  db.prepare(
    `UPDATE projects SET slug = ?, title = ?, location = ?, summary = ?, description = ?, status = ?, category = ?,
       cover_image = ?, video_url = ?, published = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(
    slug, title.trim(), location || "", summary || "", description || "",
    status || "ongoing", category === "heritage" ? "heritage" : "portfolio",
    coverPath, (video_url || "").trim() || null, published ? 1 : 0, project.id
  );

  res.redirect(`/admin/projects/${project.id}/edit`);
});

router.post("/projects/:id/delete", (req, res) => {
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
  if (project) {
    const media = db.prepare("SELECT file_path FROM project_media WHERE project_id = ?").all(project.id);
    media.forEach(item => removeUploadedFile(item.file_path));
    removeUploadedFile(project.cover_image);
    db.prepare("DELETE FROM projects WHERE id = ?").run(project.id);
  }
  res.redirect("/admin/projects");
});

router.post("/projects/:id/media", upload.array("media_files", 20), (req, res) => {
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
  if (!project) return res.status(404).send("Project not found.");

  const insert = db.prepare(
    "INSERT INTO project_media (project_id, type, file_path, caption, sort_order) VALUES (?, ?, ?, ?, ?)"
  );
  const maxOrder = db
    .prepare("SELECT COALESCE(MAX(sort_order), 0) AS n FROM project_media WHERE project_id = ?")
    .get(project.id).n;

  (req.files || []).forEach((file, index) => {
    const type = IMAGE_TYPES.has(file.mimetype) ? "image" : "video";
    insert.run(project.id, type, publicPathFor(file.mimetype, file.filename), "", maxOrder + index + 1);
  });

  res.redirect(`/admin/projects/${project.id}/edit`);
});

router.post("/projects/:id/media/:mediaId/delete", (req, res) => {
  const media = db
    .prepare("SELECT * FROM project_media WHERE id = ? AND project_id = ?")
    .get(req.params.mediaId, req.params.id);
  if (media) {
    removeUploadedFile(media.file_path);
    db.prepare("DELETE FROM project_media WHERE id = ?").run(media.id);
  }
  res.redirect(`/admin/projects/${req.params.id}/edit`);
});

// --- Blog ---
router.get("/blog", (req, res) => {
  const posts = db.prepare("SELECT * FROM blog_posts ORDER BY created_at DESC").all();
  res.render("admin/blog", { title: "Manage blog", posts });
});

router.get("/blog/new", (req, res) => {
  res.render("admin/blog-form", { title: "New blog post", post: null });
});

router.post("/blog", upload.single("cover_image"), (req, res) => {
  const { title, excerpt, content, published } = req.body;
  if (!title?.trim() || !content?.trim()) return res.status(400).send("Title and content are required.");

  const slug = uniqueSlug("blog_posts", title);
  const coverPath = req.file ? publicPathFor(req.file.mimetype, req.file.filename) : null;

  db.prepare(
    "INSERT INTO blog_posts (slug, title, excerpt, content, cover_image, published) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(slug, title.trim(), excerpt || "", content, coverPath, published ? 1 : 0);

  res.redirect("/admin/blog");
});

router.get("/blog/:id/edit", (req, res) => {
  const post = db.prepare("SELECT * FROM blog_posts WHERE id = ?").get(req.params.id);
  if (!post) return res.status(404).send("Post not found.");
  res.render("admin/blog-form", { title: "Edit blog post", post });
});

router.post("/blog/:id", upload.single("cover_image"), (req, res) => {
  const post = db.prepare("SELECT * FROM blog_posts WHERE id = ?").get(req.params.id);
  if (!post) return res.status(404).send("Post not found.");

  const { title, excerpt, content, published } = req.body;
  if (!title?.trim() || !content?.trim()) return res.status(400).send("Title and content are required.");

  const slug = title.trim() !== post.title ? uniqueSlug("blog_posts", title, post.id) : post.slug;
  const coverPath = req.file ? publicPathFor(req.file.mimetype, req.file.filename) : post.cover_image;

  db.prepare(
    `UPDATE blog_posts SET slug = ?, title = ?, excerpt = ?, content = ?, cover_image = ?, published = ?,
       updated_at = datetime('now') WHERE id = ?`
  ).run(slug, title.trim(), excerpt || "", content, coverPath, published ? 1 : 0, post.id);

  res.redirect(`/admin/blog/${post.id}/edit`);
});

router.post("/blog/:id/delete", (req, res) => {
  const post = db.prepare("SELECT * FROM blog_posts WHERE id = ?").get(req.params.id);
  if (post) {
    removeUploadedFile(post.cover_image);
    db.prepare("DELETE FROM blog_posts WHERE id = ?").run(post.id);
  }
  res.redirect("/admin/blog");
});

function removeUploadedFile(publicPath) {
  if (!publicPath) return;
  const filePath = path.join(__dirname, "..", "public", publicPath);
  fs.unlink(filePath, () => {});
}

module.exports = router;
