export const requirePro = (req, res, next) => {
  if (req.user?.subscriptionStatus !== "PRO") {
    return res.status(403).json({
      error: "Subscription Required",
      message: "This feature requires a Luna Pro membership.",
    });
  }
  next();
};
