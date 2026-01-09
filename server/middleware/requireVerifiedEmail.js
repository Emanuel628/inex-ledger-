export const requireVerifiedEmail = (req, res, next) => {
  if (!req.user?.emailVerified) {
    return res.status(403).json({
      code: "EMAIL_NOT_VERIFIED",
      message: "Verify your email to unlock vault access.",
    });
  }
  next();
};
