function requireAdmin(req, res, next) {
  if (req.session?.admin) return next();
  req.session.returnTo = req.originalUrl;
  return res.redirect("/admin/login");
}

function attachAdmin(req, res, next) {
  res.locals.admin = req.session?.admin || null;
  next();
}

module.exports = { requireAdmin, attachAdmin };
