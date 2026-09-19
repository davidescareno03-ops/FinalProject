const jwt = require("jsonwebtoken");
const Profile = require("../models/profiles.models");

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    const token = authHeader.substring(7).trim();

    if (!token) {
      return res.status(401).json({
        message: "Authentication token is missing.",
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not configured.");

      return res.status(500).json({
        message: "Server authentication configuration error.",
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    if (!decoded.userId) {
      return res.status(401).json({
        message: "Invalid authentication token.",
      });
    }

    const profile = await Profile.findById(
      decoded.userId
    );

    if (!profile) {
      return res.status(401).json({
        message: "User no longer exists.",
      });
    }

    req.user = profile;

    return next();
  } catch (error) {
    console.error(
      "Authentication error:",
      error.message
    );

    return res.status(401).json({
      message: "Invalid or expired authentication token.",
    });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      message: "Authentication required.",
    });
  }

  if (req.user.admin !== true) {
    return res.status(403).json({
      message: "Administrator access required.",
    });
  }

  return next();
};

module.exports = {
  authenticateToken,
  requireAdmin,
};