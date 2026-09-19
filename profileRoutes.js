const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const Profile = require("../models/profiles.models");
const Calendar = require("../models/calendar.models");

const {
  authenticateToken,
  requireAdmin,
} = require("../middleware/authMiddleware");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not configured.");
}

const publicProfile = (profile) => ({
  _id: profile._id,
  name: profile.name,
  email: profile.email,
  username: profile.username,
  admin: profile.admin === true,
});

const createToken = (profile) =>
  jwt.sign(
    {
      userId: profile._id.toString(),
      username: profile.username,
      admin: profile.admin === true,
    },
    JWT_SECRET,
    {
      expiresIn: "1h",
    }
  );

const handleDuplicateKeyError = (
  error,
  res
) => {
  if (
    error?.code !== 11000 ||
    !error.keyPattern
  ) {
    return false;
  }

  const field =
    Object.keys(error.keyPattern)[0];

  const message =
    field === "email"
      ? "Email is already in use."
      : field === "username"
        ? "Username is already in use."
        : "That value is already in use.";

  res.status(409).json({
    message,
  });

  return true;
};

// GET ALL PROFILES - ADMIN ONLY
router.get(
  "/all",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const profiles =
        await Profile.find({
          _id: {
            $ne: req.user._id,
          },
        })
          .select("-password")
          .sort({
            createdAt: -1,
          });

      return res
        .status(200)
        .json(profiles);
    } catch (error) {
      console.error(
        "Get profiles error:",
        error.message
      );

      return res.status(500).json({
        message:
          "Unable to retrieve profiles.",
      });
    }
  }
);

// SEARCH PROFILE
router.get(
  "/search",
  authenticateToken,
  async (req, res) => {
    try {
      const username =
        req.query.username
          ?.trim()
          .toLowerCase();

      if (!username) {
        return res.status(400).json({
          message:
            "Username is required.",
        });
      }

      const profile =
        await Profile.findOne({
          username,
        }).select("-password");

      if (!profile) {
        return res.status(404).json({
          message:
            "Profile not found.",
        });
      }

      return res
        .status(200)
        .json(profile);
    } catch (error) {
      console.error(
        "Search profile error:",
        error.message
      );

      return res.status(500).json({
        message:
          "Unable to search for profile.",
      });
    }
  }
);

// REGISTER
router.post(
  "/register",
  async (req, res) => {
    try {
      const {
        name,
        email,
        username,
        password,
      } = req.body;

      const cleanName =
        typeof name === "string"
          ? name.trim()
          : "";

      const cleanEmail =
        typeof email === "string"
          ? email.trim().toLowerCase()
          : "";

      const cleanUsername =
        typeof username === "string"
          ? username.trim().toLowerCase()
          : "";

      if (
        !cleanName ||
        !cleanEmail ||
        !cleanUsername ||
        typeof password !== "string" ||
        !password
      ) {
        return res.status(400).json({
          message:
            "Name, email, username, and password are required.",
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          message:
            "Password must be at least 8 characters long.",
        });
      }

      const [
        existingUsername,
        existingEmail,
      ] = await Promise.all([
        Profile.findOne({
          username:
            cleanUsername,
        }),

        Profile.findOne({
          email: cleanEmail,
        }),
      ]);

      if (existingUsername) {
        return res.status(409).json({
          message:
            "Username is already in use.",
        });
      }

      if (existingEmail) {
        return res.status(409).json({
          message:
            "Email is already in use.",
        });
      }

      const hashedPassword =
        await bcrypt.hash(
          password,
          12
        );

      const profile =
        await Profile.create({
          name: cleanName,
          email: cleanEmail,
          username: cleanUsername,
          password: hashedPassword,
          admin: false,
        });

      return res.status(201).json({
        message:
          "Profile created successfully. You can now log in.",

        profile:
          publicProfile(profile),
      });
    } catch (error) {
      console.error(
        "Registration error:",
        error.message
      );

      if (
        handleDuplicateKeyError(
          error,
          res
        )
      ) {
        return;
      }

      return res.status(500).json({
        message:
          "Unable to create profile.",
      });
    }
  }
);

// LOGIN
router.post(
  "/login",
  async (req, res) => {
    try {
      const {
        username,
        password,
      } = req.body;

      const cleanUsername =
        typeof username === "string"
          ? username.trim().toLowerCase()
          : "";

      if (
        !cleanUsername ||
        typeof password !== "string" ||
        !password
      ) {
        return res.status(400).json({
          message:
            "Username and password are required.",
        });
      }

      const profile =
        await Profile.findOne({
          username:
            cleanUsername,
        }).select("+password");

      if (!profile) {
        return res.status(401).json({
          message:
            "Invalid username or password.",
        });
      }

      const passwordMatches =
        await bcrypt.compare(
          password,
          profile.password
        );

      if (!passwordMatches) {
        return res.status(401).json({
          message:
            "Invalid username or password.",
        });
      }

      return res.status(200).json({
        message:
          "Login successful.",

        token:
          createToken(profile),

        profile:
          publicProfile(profile),
      });
    } catch (error) {
      console.error(
        "Login error:",
        error.message
      );

      return res.status(500).json({
        message:
          "Unable to log in.",
      });
    }
  }
);

// CURRENT PROFILE
router.get(
  "/me",
  authenticateToken,
  async (req, res) => {
    try {
      const profile =
        await Profile.findById(
          req.user._id
        ).select("-password");

      if (!profile) {
        return res.status(404).json({
          message:
            "Profile not found.",
        });
      }

      return res.status(200).json({
        profile:
          publicProfile(profile),
      });
    } catch (error) {
      console.error(
        "Get current profile error:",
        error.message
      );

      return res.status(500).json({
        message:
          "Unable to retrieve profile.",
      });
    }
  }
);

// UPDATE CURRENT PROFILE - OWNER ONLY
router.put(
  "/me",
  authenticateToken,
  async (req, res) => {
    try {
      const {
        name,
        email,
        username,
        password,
      } = req.body;

      const cleanName =
        typeof name === "string"
          ? name.trim()
          : "";

      const cleanEmail =
        typeof email === "string"
          ? email.trim().toLowerCase()
          : "";

      const cleanUsername =
        typeof username === "string"
          ? username.trim().toLowerCase()
          : "";

      if (
        !cleanName ||
        !cleanEmail ||
        !cleanUsername
      ) {
        return res.status(400).json({
          message:
            "Name, email, and username are required.",
        });
      }

      if (
        password !== undefined &&
        password !== "" &&
        (
          typeof password !== "string" ||
          password.length < 8
        )
      ) {
        return res.status(400).json({
          message:
            "Password must be at least 8 characters long.",
        });
      }

      const duplicateUsername =
        await Profile.findOne({
          username: cleanUsername,
          _id: { $ne: req.user._id },
        });

      if (duplicateUsername) {
        return res.status(409).json({
          message:
            "Username is already in use.",
        });
      }

      const duplicateEmail =
        await Profile.findOne({
          email: cleanEmail,
          _id: { $ne: req.user._id },
        });

      if (duplicateEmail) {
        return res.status(409).json({
          message:
            "Email is already in use.",
        });
      }

      const update = {
        name: cleanName,
        email: cleanEmail,
        username: cleanUsername,
      };

      if (
        typeof password === "string" &&
        password
      ) {
        update.password =
          await bcrypt.hash(
            password,
            12
          );
      }

      const updatedProfile =
        await Profile.findByIdAndUpdate(
          req.user._id,
          update,
          {
            new: true,
            runValidators: true,
          }
        ).select("-password");

      if (!updatedProfile) {
        return res.status(404).json({
          message:
            "Profile not found.",
        });
      }

      return res.status(200).json({
        message:
          "Profile updated successfully.",
        profile:
          publicProfile(updatedProfile),
      });
    } catch (error) {
      console.error(
        "Update current profile error:",
        error.message
      );

      if (
        handleDuplicateKeyError(
          error,
          res
        )
      ) {
        return;
      }

      return res.status(500).json({
        message:
          "Unable to update profile.",
      });
    }
  }
);

// UPDATE PROFILE - ADMIN ONLY
router.put(
  "/:id",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { id } =
        req.params;

      if (
        !mongoose.Types.ObjectId.isValid(
          id
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid profile ID.",
        });
      }

      const {
        name,
        email,
        username,
        password,
      } = req.body;

      if (
        !(await Profile.exists({
          _id: id,
        }))
      ) {
        return res.status(404).json({
          message:
            "Profile not found.",
        });
      }

      const cleanName =
        typeof name === "string"
          ? name.trim()
          : "";

      const cleanEmail =
        typeof email === "string"
          ? email.trim().toLowerCase()
          : "";

      const cleanUsername =
        typeof username === "string"
          ? username.trim().toLowerCase()
          : "";

      if (
        !cleanName ||
        !cleanEmail ||
        !cleanUsername
      ) {
        return res.status(400).json({
          message:
            "Name, email, and username are required.",
        });
      }

      if (
        password !== undefined &&
        password !== "" &&
        (
          typeof password !== "string" ||
          password.length < 8
        )
      ) {
        return res.status(400).json({
          message:
            "Password must be at least 8 characters long.",
        });
      }

      const update = {
        name: cleanName,
        email: cleanEmail,
        username: cleanUsername,
      };

      if (
        typeof password === "string" &&
        password
      ) {
        update.password =
          await bcrypt.hash(
            password,
            12
          );
      }

      const updatedProfile =
        await Profile.findByIdAndUpdate(
          id,
          update,
          {
            new: true,
            runValidators: true,
          }
        ).select("-password");

      if (!updatedProfile) {
        return res.status(404).json({
          message:
            "Profile not found.",
        });
      }

      return res.status(200).json({
        message:
          "Profile updated successfully.",

        profile:
          publicProfile(
            updatedProfile
          ),
      });
    } catch (error) {
      console.error(
        "Update profile error:",
        error.message
      );

      if (
        handleDuplicateKeyError(
          error,
          res
        )
      ) {
        return;
      }

      return res.status(500).json({
        message:
          "Unable to update profile.",
      });
    }
  }
);

// DELETE PROFILE - ADMIN ONLY
router.delete(
  "/:id",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { id } =
        req.params;

      if (
        !mongoose.Types.ObjectId.isValid(
          id
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid profile ID.",
        });
      }

      if (
        req.user._id.toString() ===
        id
      ) {
        return res.status(400).json({
          message:
            "You cannot delete your own administrator account.",
        });
      }

      const deletedProfile =
        await Profile.findByIdAndDelete(
          id
        );

      if (!deletedProfile) {
        return res.status(404).json({
          message:
            "Profile not found.",
        });
      }

      await Calendar.deleteOne({
        userId: id,
      });

      return res.status(200).json({
        message:
          "Profile deleted successfully.",

        profile:
          publicProfile(
            deletedProfile
          ),
      });
    } catch (error) {
      console.error(
        "Delete profile error:",
        error.message
      );

      return res.status(500).json({
        message:
          "Unable to delete profile.",
      });
    }
  }
);

module.exports = router;