module.exports = {
  requireAuth: (req, res, next) => {
    if (req.session && req.session.isAuthenticated) {
      next();
    } else {
      res.redirect('/login');
    }
  }
};